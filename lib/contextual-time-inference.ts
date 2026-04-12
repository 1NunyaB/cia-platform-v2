import type {
  AnalysisSupplemental,
  ContextualTimeInference,
  ContextualTimeInferenceReferenceType,
  SupplementalTimelineEvent,
  TimelineTimingBasis,
} from "@/types/analysis";

const REFERENCE_TYPES = new Set<ContextualTimeInferenceReferenceType>([
  "holiday",
  "public_event",
  "media_event",
  "cross_evidence_pattern",
  "other",
]);

const SPECIFICITY = new Set<ContextualTimeInference["specificity"]>([
  "specific_known_year",
  "vague_or_ambiguous",
  "multiple_possible_windows",
]);

function trim(s: unknown): string {
  return typeof s === "string" ? s.trim() : "";
}

/** Normalize one contextual inference block from model output (Zod may pass partials). */
export function normalizeContextualTimeInference(raw: unknown): ContextualTimeInference | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const o = raw as Record<string, unknown>;
  const refType = o.reference_type;
  const specificity = o.specificity;
  if (!REFERENCE_TYPES.has(refType as ContextualTimeInferenceReferenceType)) return undefined;
  if (!SPECIFICITY.has(specificity as ContextualTimeInference["specificity"])) return undefined;

  const time_windows = Array.isArray(o.time_windows)
    ? o.time_windows.map((w) => {
        if (!w || typeof w !== "object") return {};
        const x = w as Record<string, unknown>;
        return {
          start: x.start != null ? String(x.start) : null,
          end: x.end != null ? String(x.end) : null,
          label: x.label != null ? String(x.label) : undefined,
        };
      })
    : [];

  const reference_description = trim(o.reference_description);
  const limitations = trim(o.limitations);
  const inference_explanation = trim(o.inference_explanation);

  if (!reference_description || !limitations || !inference_explanation) return undefined;

  return {
    reference_type: refType as ContextualTimeInferenceReferenceType,
    reference_description,
    time_windows,
    year_known: Boolean(o.year_known),
    year_assumed: o.year_assumed === undefined ? undefined : Boolean(o.year_assumed),
    limitations,
    inference_explanation,
    specificity: specificity as ContextualTimeInference["specificity"],
  };
}

function normalizeTimingBasis(raw: unknown): TimelineTimingBasis | undefined {
  if (raw === "direct_evidence" || raw === "contextual_inference" || raw === "mixed") return raw;
  return undefined;
}

/** Apply defaults so tier resolution and validation see a consistent shape. */
export function normalizeSupplementalTimelineEvent(ev: SupplementalTimelineEvent): SupplementalTimelineEvent {
  const ctx = normalizeContextualTimeInference(ev.contextual_time_inference);
  const timing_basis = normalizeTimingBasis(ev.timing_basis);

  const next: SupplementalTimelineEvent = { ...ev };

  if (ctx) {
    next.contextual_time_inference = ctx;
    if (timing_basis) {
      next.timing_basis = timing_basis;
    } else {
      const hasParseable =
        typeof next.occurred_at === "string" &&
        next.occurred_at.trim().length > 0 &&
        !Number.isNaN(new Date(next.occurred_at).getTime());
      next.timing_basis = hasParseable ? "mixed" : "contextual_inference";
    }
  } else {
    delete next.contextual_time_inference;
    if (timing_basis === "contextual_inference") {
      delete next.timing_basis;
    } else if (timing_basis) {
      next.timing_basis = timing_basis;
    } else {
      delete next.timing_basis;
    }
  }
  return next;
}

export function normalizeSupplementalTimeline(supplemental: AnalysisSupplemental): AnalysisSupplemental {
  return {
    ...supplemental,
    timeline: supplemental.timeline.map((t) => normalizeSupplementalTimelineEvent(t)),
  };
}

/** True when the event is anchored by verbatim extract time (or mixed), not solely by contextual inference. */
export function eventHasDirectTimestampEvidence(ev: SupplementalTimelineEvent): boolean {
  if (ev.timing_basis === "direct_evidence" || ev.timing_basis === "mixed") return true;

  const hasParseable =
    typeof ev.occurred_at === "string" &&
    ev.occurred_at.trim().length > 0 &&
    !Number.isNaN(new Date(ev.occurred_at).getTime());

  if (!ev.contextual_time_inference && hasParseable) return true;
  return false;
}

/** True when timing is driven by contextual anchors (holidays, events, media) rather than direct doc text. */
export function isContextualTimingDominant(ev: SupplementalTimelineEvent): boolean {
  if (ev.timing_basis === "contextual_inference") return true;
  if (ev.contextual_time_inference && ev.timing_basis !== "direct_evidence" && ev.timing_basis !== "mixed") {
    return true;
  }
  return false;
}

/**
 * True when every timeline row lacks a direct documentary timestamp path — used to cap Conclusive findings.
 */
export function supplementalTimelineIsEntirelyContextualInference(supplemental: AnalysisSupplemental): boolean {
  const rows = supplemental.timeline ?? [];
  if (rows.length === 0) return false;
  return rows.every((ev) => !eventHasDirectTimestampEvidence(ev));
}
