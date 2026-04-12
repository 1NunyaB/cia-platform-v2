import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export async function DELETE(
  _request: Request,
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

  if ((sn.author_id as string | null) !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("evidence_sticky_notes").delete().eq("id", stickyNoteId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath(`/cases/${caseId}/evidence/${sn.evidence_file_id as string}`);
  return NextResponse.json({ ok: true });
}
