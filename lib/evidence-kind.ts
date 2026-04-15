/**
 * User-facing evidence kinds (separate from investigation stacks / clusters).
 * Suggested from MIME + filename at upload; users may confirm or reclassify.
 */
export type EvidenceKind = "document" | "image" | "video" | "audio";

export const EVIDENCE_KINDS: readonly EvidenceKind[] = ["document", "image", "video", "audio"] as const;

export const EVIDENCE_KIND_LABEL: Record<EvidenceKind, string> = {
  document: "Document",
  image: "Image",
  video: "Video",
  audio: "Audio",
};

/** Heuristic classification from declared MIME and filename — not authoritative. */
export function inferSuggestedEvidenceKind(mimeType: string | null, filename: string): EvidenceKind {
  const m = (mimeType ?? "").trim().toLowerCase();
  const n = filename.trim().toLowerCase();

  // PDFs stay at kind "document" (text, scanned pages, or mixed); users may reclassify only if they choose.
  if (m === "application/pdf" || n.endsWith(".pdf")) {
    return "document";
  }

  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";

  if (
    m.includes("pdf") ||
    m.startsWith("text/") ||
    m.includes("word") ||
    m.includes("msword") ||
    m.includes("officedocument") ||
    m.includes("spreadsheet") ||
    m.includes("presentation") ||
    m === "application/json" ||
    m === "application/xml" ||
    m.includes("rtf")
  ) {
    return "document";
  }

  const ext = n.includes(".") ? n.slice(n.lastIndexOf(".") + 1) : "";
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif", "heic"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "mkv", "m4v", "ogv", "avi"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "m4a", "flac", "aac", "opus"].includes(ext)) return "audio";
  if (["pdf", "doc", "docx", "txt", "rtf", "md", "csv", "html", "htm", "xml", "json"].includes(ext)) {
    return "document";
  }

  return "document";
}

export function parseEvidenceKind(raw: unknown): EvidenceKind | null {
  if (typeof raw !== "string") return null;
  const k = raw.trim().toLowerCase();
  if (k === "document" || k === "image" || k === "video" || k === "audio") return k;
  return null;
}

/** Library filters and badges: prefer user confirmation when set. */
export function effectiveEvidenceKind(row: {
  suggested_evidence_kind?: string | null;
  confirmed_evidence_kind?: string | null;
}): EvidenceKind {
  const c = row.confirmed_evidence_kind;
  if (c === "document" || c === "image" || c === "video" || c === "audio") return c;
  const s = row.suggested_evidence_kind;
  if (s === "document" || s === "image" || s === "video" || s === "audio") return s;
  return "document";
}

export function isEvidenceKindConfirmed(row: { confirmed_evidence_kind?: string | null }): boolean {
  const c = row.confirmed_evidence_kind;
  return c === "document" || c === "image" || c === "video" || c === "audio";
}

export type EvidenceKindUiState = {
  effective: EvidenceKind;
  suggested: EvidenceKind;
  confirmed: EvidenceKind | null;
  isConfirmed: boolean;
};

/** For UI: effective label + whether the user has confirmed (else show as suggested-only). */
export function getEvidenceKindUiState(row: {
  suggested_evidence_kind?: string | null;
  confirmed_evidence_kind?: string | null;
}): EvidenceKindUiState {
  const suggestedRaw = row.suggested_evidence_kind;
  const suggested: EvidenceKind =
    suggestedRaw === "document" || suggestedRaw === "image" || suggestedRaw === "video" || suggestedRaw === "audio"
      ? suggestedRaw
      : "document";
  const confirmedRaw = row.confirmed_evidence_kind;
  const confirmed: EvidenceKind | null =
    confirmedRaw === "document" || confirmedRaw === "image" || confirmedRaw === "video" || confirmedRaw === "audio"
      ? confirmedRaw
      : null;
  return {
    effective: effectiveEvidenceKind(row),
    suggested,
    confirmed,
    isConfirmed: confirmed !== null,
  };
}
