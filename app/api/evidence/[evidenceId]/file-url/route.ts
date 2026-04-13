import { EVIDENCE_BUCKET } from "@/services/evidence-service";
import { resolveRequestActor } from "@/lib/resolve-request-actor";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Short-lived signed URL for inline preview (images, PDF iframe). Same access rules as extract API. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ evidenceId: string }> },
) {
  const { evidenceId } = await params;
  const actor = await resolveRequestActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = actor.mode === "user" ? actor.supabase : actor.service;
  let q = client
    .from("evidence_files")
    .select("storage_path, mime_type, original_filename, display_filename")
    .eq("id", evidenceId);
  if (actor.mode === "guest") {
    q = q.eq("guest_session_id", actor.guestSessionId);
  }
  const { data: ev, error } = await q.maybeSingle();
  if (error || !ev?.storage_path) {
    return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
  }

  const { data: signed, error: signErr } = await client.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(ev.storage_path as string, 3600);

  if (signErr || !signed?.signedUrl) {
    return NextResponse.json(
      { error: signErr?.message ?? "Could not create file link" },
      { status: 500 },
    );
  }

  const filename =
    (ev.display_filename as string | null)?.trim() ||
    (ev.original_filename as string | null)?.trim() ||
    "file";

  const viewerLabel =
    actor.mode === "user"
      ? `user:${actor.userId.slice(0, 8)}`
      : `guest:${actor.guestSessionId.slice(0, 8)}`;

  return NextResponse.json({
    url: signed.signedUrl,
    mimeType: (ev.mime_type as string | null) ?? null,
    filename,
    viewerLabel,
  });
}
