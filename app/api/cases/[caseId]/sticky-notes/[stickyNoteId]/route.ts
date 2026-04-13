import { createClient } from "@/lib/supabase/server";
import { ADMIN_DELETE_CONFIRM_CODE, isPlatformDeleteAdmin } from "@/lib/admin-guard";
import { logActivity } from "@/services/activity-service";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ caseId: string; stickyNoteId: string }> },
) {
  const { caseId, stickyNoteId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: sn, error: fErr } = await supabase
    .from("evidence_sticky_notes")
    .select("id, evidence_file_id, author_id")
    .eq("id", stickyNoteId)
    .eq("case_id", caseId)
    .maybeSingle();

  if (fErr || !sn) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (!isPlatformDeleteAdmin(user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const code = request.headers.get("x-admin-confirm-code");
  if (code !== ADMIN_DELETE_CONFIRM_CODE) {
    return NextResponse.json({ error: "Admin confirmation code required." }, { status: 400 });
  }

  const { error } = await supabase.from("evidence_sticky_notes").delete().eq("id", stickyNoteId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  await logActivity(supabase, {
    action: "sticky.deleted_admin",
    caseId,
    actorId: user.id,
    entityType: "evidence_sticky_note",
    entityId: stickyNoteId,
    payload: { evidence_file_id: sn.evidence_file_id },
  });

  revalidatePath(`/cases/${caseId}/evidence/${sn.evidence_file_id as string}`);
  return NextResponse.json({ ok: true });
}
