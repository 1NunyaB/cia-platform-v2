/** Extension → MIME when DB `mime_type` is missing or generic (e.g. octet-stream after upload). */
const EXT_TO_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".svg": "image/svg+xml",
  ".avif": "image/avif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".m4v": "video/x-m4v",
  ".ogv": "video/ogg",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".ogg": "audio/ogg",
  ".m4a": "audio/mp4",
  ".flac": "audio/flac",
  ".aac": "audio/aac",
};

function mimeFromFilename(filename: string): string | null {
  const fn = filename.trim().toLowerCase();
  const dot = fn.lastIndexOf(".");
  if (dot < 0) return null;
  return EXT_TO_MIME[fn.slice(dot)] ?? null;
}

/** Shared MIME normalization for evidence download + signed-URL responses. */
export function normalizeEvidenceMimeType(mimeType: string | null, filename: string): string | null {
  const raw = (mimeType ?? "").trim();
  const lower = raw.toLowerCase();
  const inferred = mimeFromFilename(filename);

  const isGeneric =
    lower === "application/octet-stream" ||
    lower === "" ||
    lower === "binary/octet-stream" ||
    lower === "application/x-download";

  if (isGeneric && inferred) return inferred;
  if (!raw && inferred) return inferred;
  return raw || null;
}
