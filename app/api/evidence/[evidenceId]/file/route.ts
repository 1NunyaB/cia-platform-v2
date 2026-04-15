import { EVIDENCE_BUCKET } from "@/services/evidence-service";
import { normalizeEvidenceMimeType } from "@/lib/evidence-file-mime";
import { resolveRequestActor } from "@/lib/resolve-request-actor";
import { tryCreateServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Parse `Range: bytes=…` for media seeking (single range only). */
function parseBytesRange(rangeHeader: string, total: number): { start: number; end: number } | null {
  const raw = rangeHeader.trim();
  if (!raw.toLowerCase().startsWith("bytes=")) return null;
  const spec = raw.slice(6).trim();
  const dash = spec.indexOf("-");
  if (dash < 0) return null;
  const left = spec.slice(0, dash);
  const right = spec.slice(dash + 1);

  if (left === "" && right !== "") {
    const suffixLen = parseInt(right, 10);
    if (Number.isNaN(suffixLen) || suffixLen < 1) return null;
    const start = Math.max(0, total - suffixLen);
    return { start, end: total - 1 };
  }

  let start = left ? parseInt(left, 10) : 0;
  let end = right !== "" ? parseInt(right, 10) : total - 1;
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  if (start >= total) return null;
  start = Math.max(0, start);
  end = Math.min(end, total - 1);
  if (end < start) return null;
  return { start, end };
}

/**
 * Same-origin stream of the evidence bytes for inline preview (PDF.js, `<img>`, `<video>`, open in tab).
 * Avoids cross-origin signed-URL fetch/CORS issues from workers or media elements.
 * Supports `Range` requests so video/audio can seek in the embedded player.
 */
export async function GET(
  request: Request,
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
    if (process.env.NODE_ENV === "development") {
      console.warn("[evidence-file] row missing", { evidenceId, error: error?.message });
    }
    return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
  }

  const storagePath = ev.storage_path as string;
  const filename =
    (ev.display_filename as string | null)?.trim() ||
    (ev.original_filename as string | null)?.trim() ||
    "file";
  const mimeNormalized = normalizeEvidenceMimeType((ev.mime_type as string | null) ?? null, filename);

  const storageReader = tryCreateServiceClient() ?? client;
  const { data: blob, error: dlErr } = await storageReader.storage.from(EVIDENCE_BUCKET).download(storagePath);

  if (dlErr || !blob) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[evidence-file] storage download failed", {
        evidenceId,
        storagePath,
        message: dlErr?.message,
      });
    }
    return NextResponse.json(
      { error: dlErr?.message ?? "Could not read file from storage" },
      { status: 502 },
    );
  }

  const contentType = mimeNormalized || "application/octet-stream";
  const ab = await blob.arrayBuffer();
  const total = ab.byteLength;

  if (process.env.NODE_ENV === "development") {
    console.info("[evidence-file] streaming", {
      evidenceId,
      storagePath,
      mimeType: contentType,
      size: total,
    });
  }

  const range = request.headers.get("range");
  if (range && total > 0) {
    const parsed = parseBytesRange(range, total);
    if (parsed) {
      const { start, end } = parsed;
      const chunk = ab.slice(start, end + 1);
      const headers = new Headers();
      headers.set("Content-Type", contentType);
      headers.set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(filename)}`);
      headers.set("Cache-Control", "private, no-store");
      headers.set("X-Content-Type-Options", "nosniff");
      headers.set("Accept-Ranges", "bytes");
      headers.set("Content-Range", `bytes ${start}-${end}/${total}`);
      headers.set("Content-Length", String(chunk.byteLength));
      return new NextResponse(chunk, { status: 206, headers });
    }
  }

  const headers = new Headers();
  headers.set("Content-Type", contentType);
  headers.set("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(filename)}`);
  headers.set("Cache-Control", "private, no-store");
  headers.set("X-Content-Type-Options", "nosniff");
  headers.set("Accept-Ranges", "bytes");
  headers.set("Content-Length", String(total));

  return new NextResponse(ab, { headers });
}
