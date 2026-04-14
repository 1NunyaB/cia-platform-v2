import { EVIDENCE_BUCKET } from "@/services/evidence-service";
import { normalizeEvidenceMimeType } from "@/lib/evidence-file-mime";
import { resolveRequestActor } from "@/lib/resolve-request-actor";
import { tryCreateServiceClient } from "@/lib/supabase/service";
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

  const storagePath = ev.storage_path as string;

  const streamPath = `/api/evidence/${evidenceId}/file`;
  const signingClient = tryCreateServiceClient() ?? client;
  const { data: signed, error: signErr } = await signingClient.storage
    .from(EVIDENCE_BUCKET)
    .createSignedUrl(storagePath, 3600);

  const filename =
    (ev.display_filename as string | null)?.trim() ||
    (ev.original_filename as string | null)?.trim() ||
    "file";

  const mimeNormalized = normalizeEvidenceMimeType((ev.mime_type as string | null) ?? null, filename);

  if (process.env.NODE_ENV === "development") {
    try {
      const u = signed?.signedUrl ? new URL(signed.signedUrl) : null;
      console.info("[evidence-file-url]", {
        evidenceId,
        storagePath,
        mimeType: mimeNormalized,
        signedUrlHost: u?.host ?? null,
        signedUrlPathPreview: u ? `${u.pathname.slice(0, 48)}…` : null,
        signedUrlOk: Boolean(signed?.signedUrl),
        signError: signErr?.message ?? null,
      });
    } catch {
      console.info("[evidence-file-url]", {
        evidenceId,
        storagePath,
        mimeType: mimeNormalized,
        signedUrl: signed?.signedUrl ? "unparseable" : null,
        signError: signErr?.message ?? null,
      });
    }
  }

  const viewerLabel =
    actor.mode === "user"
      ? `user:${actor.userId.slice(0, 8)}`
      : `guest:${actor.guestSessionId.slice(0, 8)}`;

  return NextResponse.json({
    url: signed?.signedUrl ?? streamPath,
    /** Same-origin URL (session cookie) — reliable for PDF.js, iframe, and “open file”. */
    streamUrl: streamPath,
    mimeType: mimeNormalized,
    filename,
    viewerLabel,
  });
}
