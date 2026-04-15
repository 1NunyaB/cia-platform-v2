/** Mirrors `evidence_files.source_type` check constraint and upload UI. */
export const EVIDENCE_SOURCE_TYPES = [
  "website",
  "broadcast",
  "program",
  "podcast",
  "video",
  "article",
  "social",
  "other",
  "unknown",
] as const;

export type EvidenceSourceType = (typeof EVIDENCE_SOURCE_TYPES)[number];

export const EVIDENCE_SOURCE_TYPE_LABELS: Record<EvidenceSourceType, string> = {
  website: "Website / URL",
  broadcast: "Broadcast / network",
  program: "TV / radio program",
  podcast: "Podcast",
  video: "Video (platform clip)",
  article: "Article / written piece",
  social: "Social media post",
  other: "Other",
  unknown: "Unknown / not specified",
};

export type EvidenceSourcePayload = {
  source_type: EvidenceSourceType;
  source_platform: string | null;
  source_program: string | null;
  source_url: string | null;
};

function normalizeMaybeUrl(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  try {
    const u = new URL(withProtocol);
    if (!u.hostname) return null;
    return u.toString();
  } catch {
    return null;
  }
}

export function parseEvidenceSourceFromFormData(fd: FormData): EvidenceSourcePayload {
  const raw = String(fd.get("source_type") ?? "").trim().toLowerCase();
  const source_type = (EVIDENCE_SOURCE_TYPES as readonly string[]).includes(raw)
    ? (raw as EvidenceSourceType)
    : "unknown";
  const platform = String(fd.get("source_platform") ?? "").trim();
  const program = String(fd.get("source_program") ?? "").trim();
  const url = normalizeMaybeUrl(String(fd.get("source_url") ?? ""));
  return {
    source_type,
    source_platform: platform || null,
    source_program: program || null,
    source_url: url,
  };
}

export function normalizeEvidenceSourcePayload(input: Partial<EvidenceSourcePayload>): EvidenceSourcePayload {
  const raw = String(input.source_type ?? "unknown").toLowerCase();
  const source_type = (EVIDENCE_SOURCE_TYPES as readonly string[]).includes(raw)
    ? (raw as EvidenceSourceType)
    : "unknown";
  return {
    source_type,
    source_platform: input.source_platform?.trim() || null,
    source_program: input.source_program?.trim() || null,
    source_url: normalizeMaybeUrl(input.source_url),
  };
}
