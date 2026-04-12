import type { AnalysisClassification } from "@/types/analysis";
import type { SupplementalTimelineEvent, TimelineTier } from "@/types/analysis";
import { isContextualTimingDominant } from "@/lib/contextual-time-inference";

export type { TimelineTier } from "@/types/analysis";
export { TIMELINE_TIER_LABELS } from "@/types/analysis";

/** Vague or implied timing cues — cap below T1 when combined with weak signals. */
const VAGUE_TIMING_PATTERN =
  /\b(approx(imately)?|around|circa|early|mid|late\s+\d{4}|sometime|roughly|unclear\s+when|date\s+unknown)\b/i;

function hasParseableOccurredAt(event: SupplementalTimelineEvent): boolean {
  return (
    typeof event.occurred_at === "string" &&
    event.occurred_at.trim().length > 0 &&
    !Number.isNaN(new Date(event.occurred_at).getTime())
  );
}

/**
 * Resolves the canonical timeline tier for one supplemental event at persist time.
 *
 * **Contextual time** (holidays, public/media events, cross-evidence patterns): never Timeline 1 from a
 * single file; vague or multiple competing windows stay at Timeline 3; specific known year can reach
 * Timeline 2 with one file, or Timeline 1 with multi-source corroboration (no documentary timestamp required
 * when specificity is `specific_known_year` and classification allows).
 *
 * **T1** — Confirmed/Conclusive only; multi-source; not vague_or_ambiguous / multiple_possible_windows;
 * either documentary time (`direct_evidence` / `mixed` / explicit date without contextual block) with
 * parseable `occurred_at` and no vague wording, OR strong contextual corroboration (`specific_known_year`
 * + multi-source + contextual-dominant path).
 *
 * Conflicts with model `timeline_tier` hints are ignored — this function is authoritative.
 */
export function resolveTimelineTier(args: {
  event: SupplementalTimelineEvent;
  findingClassification: AnalysisClassification;
  originEvidenceId: string;
  resolvedSupportingEvidenceIds: string[];
}): TimelineTier {
  const { event, findingClassification: cls, originEvidenceId, resolvedSupportingEvidenceIds } = args;

  const support = new Set<string>([originEvidenceId, ...resolvedSupportingEvidenceIds]);
  const multiSource = support.size >= 2;

  const ctx = event.contextual_time_inference;
  const specificity = ctx?.specificity;

  const blob = `${event.title}\n${event.summary ?? ""}`;
  const vagueWording = VAGUE_TIMING_PATTERN.test(blob);

  if (cls === "Uncertain" || cls === "Reconstructed") {
    return "t3_leads";
  }

  /** Ambiguous windows or competing hypotheses — always Leads tier. */
  if (specificity === "vague_or_ambiguous" || specificity === "multiple_possible_windows") {
    return "t3_leads";
  }

  const contextualDominant = isContextualTimingDominant(event);
  const specificKnownYear = specificity === "specific_known_year";

  /** Document-explicit time path (not solely inferred from context). */
  const directDocTime =
    event.timing_basis === "direct_evidence" ||
    event.timing_basis === "mixed" ||
    (hasParseableOccurredAt(event) && !event.contextual_time_inference);

  const t1FromDirectTimestamp =
    (cls === "Confirmed" || cls === "Conclusive") &&
    multiSource &&
    directDocTime &&
    hasParseableOccurredAt(event) &&
    !vagueWording;

  const t1FromStrongContextual =
    (cls === "Confirmed" || cls === "Conclusive") &&
    multiSource &&
    contextualDominant &&
    specificKnownYear &&
    Boolean(ctx) &&
    !vagueWording;

  if (t1FromDirectTimestamp || t1FromStrongContextual) {
    return "t1_confirmed";
  }

  if (cls === "Inferred" || cls === "Correlated") {
    if (multiSource) return "t2_supported";
    if (ctx && specificKnownYear) return "t2_supported";
    return "t3_leads";
  }

  if (cls === "Confirmed" || cls === "Conclusive") {
    if (!multiSource) {
      if (ctx && specificKnownYear) return "t2_supported";
      return "t3_leads";
    }
    if (!hasParseableOccurredAt(event) && !(ctx && specificKnownYear)) {
      return "t3_leads";
    }
    if (vagueWording) return "t2_supported";
    return "t2_supported";
  }

  return "t3_leads";
}

export function parseTimelineTierHint(raw: unknown): TimelineTier | undefined {
  if (raw === 1 || raw === "1" || raw === "t1" || raw === "T1" || raw === "timeline_1") return "t1_confirmed";
  if (raw === 2 || raw === "2" || raw === "t2" || raw === "T2" || raw === "timeline_2") return "t2_supported";
  if (raw === 3 || raw === "3" || raw === "t3" || raw === "T3" || raw === "timeline_3") return "t3_leads";
  if (raw === "t1_confirmed" || raw === "t2_supported" || raw === "t3_leads") return raw;
  return undefined;
}
