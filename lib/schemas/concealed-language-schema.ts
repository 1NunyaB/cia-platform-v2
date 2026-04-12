import { z } from "zod";
import type {
  ConcealedLanguageAnalysisDetail,
  ConcealedLanguageFlaggedPhrase,
  ConcealedLanguageUsageStrength,
} from "@/types/analysis";

const USAGE_STRENGTH_VALUES: ConcealedLanguageUsageStrength[] = [
  "ordinary_likely",
  "isolated_unusual",
  "repeated_within_source",
  "repeated_cross_source",
];

const detailSchema = z.object({
  overview: z.string().optional(),
  case_only_scope_note: z.string().optional(),
  conservative_summary: z.string().optional(),
  /** Model may use alternate keys; each row is coerced in normalize. */
  flagged_phrases: z.array(z.unknown()).optional().default([]),
});

const MAX_PHRASES = 24;

function normalizeStrength(raw: unknown): ConcealedLanguageUsageStrength {
  const s = typeof raw === "string" ? raw.trim().toLowerCase().replace(/\s+/g, "_") : "";
  const aliases: Record<string, ConcealedLanguageUsageStrength> = {
    ordinary_likely: "ordinary_likely",
    ordinary: "ordinary_likely",
    benign: "ordinary_likely",
    isolated_unusual: "isolated_unusual",
    isolated: "isolated_unusual",
    single_occurrence: "isolated_unusual",
    repeated_within_source: "repeated_within_source",
    within_source: "repeated_within_source",
    intra_source: "repeated_within_source",
    repeated_cross_source: "repeated_cross_source",
    cross_source: "repeated_cross_source",
    multi_source: "repeated_cross_source",
  };
  const m = aliases[s] ?? (USAGE_STRENGTH_VALUES.includes(s as ConcealedLanguageUsageStrength) ? (s as ConcealedLanguageUsageStrength) : null);
  return m ?? "isolated_unusual";
}

function trim(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

function coercePhrase(o: Record<string, unknown>): ConcealedLanguageFlaggedPhrase {
  return {
    flagged_phrase: trim(o.flagged_phrase) || trim(o.flaggedPhrase) || "—",
    why_it_was_flagged: trim(o.why_it_was_flagged) || trim(o.why_flagged) || trim(o.whyItWasFlagged) || "—",
    where_it_appears: trim(o.where_it_appears) || trim(o.locations) || trim(o.where_it_appears_in_extract) || "—",
    occurrence_summary: trim(o.occurrence_summary) || trim(o.how_often) || "—",
    surrounding_context:
      trim(o.surrounding_context) || trim(o.context_entities_dates_places) || trim(o.nearby_context) || "—",
    ordinary_vs_suspicious:
      trim(o.ordinary_vs_suspicious) || trim(o.ordinary_vs_suspicious_usage) || trim(o.ordinary_usage) || "—",
    repeated_usage: trim(o.repeated_usage) || trim(o.repeated_usage_notes) || "—",
    possible_non_literal_meaning:
      trim(o.possible_non_literal_meaning) || trim(o.alternative_meanings) || "—",
    what_cannot_be_determined: trim(o.what_cannot_be_determined) || trim(o.limits) || "—",
    usage_strength: normalizeStrength(o.usage_strength),
  };
}

/**
 * Parse and normalize model output. Returns null if absent or empty.
 */
export function normalizeConcealedLanguageAnalysis(input: unknown): ConcealedLanguageAnalysisDetail | null {
  if (!input || typeof input !== "object") return null;
  const parsed = detailSchema.safeParse(input);
  if (!parsed.success) return null;
  const d = parsed.data;
  const phrases = (d.flagged_phrases ?? [])
    .slice(0, MAX_PHRASES)
    .filter((p): p is Record<string, unknown> => p != null && typeof p === "object" && !Array.isArray(p))
    .map((p) => coercePhrase(p));
  const overview = trim(d.overview);
  const caseNote = trim(d.case_only_scope_note);
  const summary = trim(d.conservative_summary);
  const anyContent =
    phrases.length > 0 ||
    (overview.length > 2 && overview !== "—") ||
    (summary.length > 2 && summary !== "—");
  if (!anyContent) return null;

  return {
    overview: overview || "No concealed-language flags in this pass (or insufficient text).",
    case_only_scope_note:
      caseNote ||
      "Analysis is limited to the supplied extract and structured fields from this model run — no outside lore.",
    conservative_summary: summary || "No additional conservative summary provided.",
    flagged_phrases: phrases,
  };
}
