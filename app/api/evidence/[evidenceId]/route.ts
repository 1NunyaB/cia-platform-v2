import { createClient } from "@/lib/supabase/server";
import { ADMIN_DELETE_CONFIRM_CODE, assertPlatformDeleteAdmin } from "@/lib/admin-guard";
import { EVIDENCE_BUCKET } from "@/services/evidence-service";
import { logActivity } from "@/services/activity-service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ evidenceId: string }> },
) {
  const { evidenceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    assertPlatformDeleteAdmin(user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 403 });
  }

  const confirmCode = request.headers.get("x-admin-confirm-code")?.trim();
  if (confirmCode !== ADMIN_DELETE_CONFIRM_CODE) {
    return NextResponse.json({ error: "Admin confirmation code required." }, { status: 403 });
  }

  const { data: row, error: fetchErr } = await supabase
    .from("evidence_files")
    .select("id, case_id, storage_path, original_filename")
    .eq("id", evidenceId)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!row) return NextResponse.json({ error: "Evidence not found." }, { status: 404 });

  const storagePath = (row.storage_path as string | null) ?? null;
  if (storagePath) {
    const { error: removeErr } = await supabase.storage.from(EVIDENCE_BUCKET).remove([storagePath]);
    if (removeErr) {
      return NextResponse.json({ error: removeErr.message }, { status: 500 });
    }
  }

  const { error: deleteErr } = await supabase.from("evidence_files").delete().eq("id", evidenceId);
  if (deleteErr) return NextResponse.json({ error: deleteErr.message }, { status: 500 });

  await logActivity(supabase, {
    caseId: (row.case_id as string | null) ?? null,
    actorId: user.id,
    actorLabel: "Admin",
    action: "evidence.deleted",
    entityType: "evidence_file",
    entityId: evidenceId,
    payload: {
      original_filename: row.original_filename,
      storage_path: storagePath,
    },
  });

  return NextResponse.json({ ok: true });
}
