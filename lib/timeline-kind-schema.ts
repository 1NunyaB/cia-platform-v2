import type { TimelineKind } from "@/types/analysis";

const KIND_SET = new Set<string>([
  "witness",
  "subject_actor",
  "official",
  "evidence",
  "reconstructed",
  "custom",
]);

/**
 * Coerce model output to a canonical timeline lane. Analysis runs default to `evidence` when missing or invalid.
 */
export function normalizeTimelineKind(raw: unknown): TimelineKind {
  if (raw === undefined || raw === null) return "evidence";
  const s = typeof raw === "string" ? raw.trim().toLowerCase().replace(/\s+/g, "_") : "";
  const aliases: Record<string, TimelineKind> = {
    witness: "witness",
    subject: "subject_actor",
    subject_actor: "subject_actor",
    "subject/actor": "subject_actor",
    actor: "subject_actor",
    official: "official",
    evidence: "evidence",
    reconstructed: "reconstructed",
    custom: "custom",
  };
  const mapped = aliases[s] ?? (KIND_SET.has(s) ? (s as TimelineKind) : null);
  return mapped ?? "evidence";
}
