/** Classify evidence MIME for inline preview / list thumbnails (client + server). */
export type EvidencePreviewKind = "image" | "pdf" | "video" | "audio" | "none";

export function evidencePreviewKindFromMime(mimeType: string | null | undefined): EvidencePreviewKind {
  const m = (mimeType ?? "").trim().toLowerCase();
  if (!m) return "none";
  if (m.startsWith("image/")) return "image";
  if (m === "application/pdf" || m.includes("pdf")) return "pdf";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  return "none";
}

/** When `mime_type` is missing, infer a coarse kind from the stored filename (list thumbnails). */
export function evidencePreviewKindFromFilename(filename: string | null | undefined): EvidencePreviewKind {
  const n = (filename ?? "").trim().toLowerCase();
  if (!n) return "none";
  const ext = n.includes(".") ? n.slice(n.lastIndexOf(".") + 1) : "";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"].includes(ext)) return "image";
  if (ext === "pdf") return "pdf";
  if (["mp4", "webm", "mov", "mkv", "m4v", "ogv"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "m4a", "flac", "aac"].includes(ext)) return "audio";
  return "none";
}

export function resolveEvidencePreviewKind(
  mimeType: string | null | undefined,
  filenameHint?: string | null,
): EvidencePreviewKind {
  const fromMime = evidencePreviewKindFromMime(mimeType);
  if (fromMime !== "none") return fromMime;
  return evidencePreviewKindFromFilename(filenameHint);
}
