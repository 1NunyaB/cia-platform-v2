import { z } from "zod";
import {
  ANALYSIS_CLASSIFICATION_LABELS,
  isAnalysisClassification,
  normalizeClassification,
  type AnalysisClassification,
  type AnalysisConfidence,
  type StructuredFinding,
} from "@/types/analysis";

/**
 * Canonical seven-field analysis finding — single schema for persistence validation and UI.
 * Order for display is defined by STRUCTURED_FINDING_SECTIONS (never reorder without updating UI).
 *
 * After parsing, run `normalizeStructuredFinding` then `enforceFindingDiscipline` so platform-wide
 * priority rules (accuracy → evidence support → conservative labels → actionable next_step) apply,
 * including strict redaction language rules (no false recovery of withheld text; Conclusive never from redacted spans alone).
 * Optional `redaction_analysis` is normalized separately (`normalizeRedactionAnalysisDetail`).
 *
 * Classification labels must match ANALYSIS_CLASSIFICATION_LABELS in types/analysis.ts exactly.
 */
export const CONFIDENCE_VALUES = ["high", "medium", "low"] as const;

/** @deprecated Use ANALYSIS_CLASSIFICATION_LABELS — kept for existing imports. */
export const CLASSIFICATION_VALUES = ANALYSIS_CLASSIFICATION_LABELS;

export const structuredFindingSchema = z.object({
  finding_answer: z.string(),
  evidence_basis: z.string(),
  confidence: z.enum(CONFIDENCE_VALUES),
  classification: z.custom<AnalysisClassification>(
    (v) => isAnalysisClassification(v),
    { message: `classification must be one of: ${ANALYSIS_CLASSIFICATION_LABELS.join(", ")}` },
  ),
  reasoning: z.string(),
  limitations: z.string(),
  next_step: z.string(),
});

export type StructuredFindingInput = z.infer<typeof structuredFindingSchema>;

/** Display order and labels — must match product requirements exactly. */
export const STRUCTURED_FINDING_SECTIONS = [
  { key: "finding_answer", label: "Finding / Answer", variant: "emphasis" as const },
  { key: "evidence_basis", label: "Evidence Basis", variant: "body" as const },
  { key: "confidence", label: "Confidence", variant: "badge-confidence" as const },
  { key: "classification", label: "Classification", variant: "badge-classification" as const },
  { key: "reasoning", label: "Reasoning", variant: "body" as const },
  { key: "limitations", label: "Limitations", variant: "body" as const },
  { key: "next_step", label: "Next Step", variant: "body" as const },
] as const;

const STRING_FALLBACKS = {
  finding_answer: "No finding stated — see limitations.",
  evidence_basis: "No direct basis in the supplied text; limitations apply.",
  reasoning: "No additional reasoning provided.",
  limitations: "Evidence text was missing or insufficient for stronger conclusions.",
  next_step: "Obtain additional source text or verification.",
} as const;

function strField(o: Record<string, unknown>, key: string): string {
  const v = o[key];
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "";
  return String(v);
}

function coercePartialFinding(input: unknown): z.infer<typeof structuredFindingSchema> {
  if (!input || typeof input !== "object") {
    return {
      finding_answer: "",
      evidence_basis: "",
      confidence: "low",
      classification: "Uncertain",
      reasoning: "",
      limitations: "",
      next_step: "",
    };
  }
  const o = input as Record<string, unknown>;
  const c = o.confidence;
  return {
    finding_answer: strField(o, "finding_answer"),
    evidence_basis: strField(o, "evidence_basis"),
    confidence:
      c === "high" || c === "medium" || c === "low" ? c : "low",
    classification: normalizeClassification(o.classification),
    reasoning: strField(o, "reasoning"),
    limitations: strField(o, "limitations"),
    next_step: strField(o, "next_step"),
  };
}

/**
 * Coerce unknown input into a valid StructuredFinding: trim strings, fill missing/blank fields,
 * clamp invalid enums to safe defaults (then caller may run Conclusive rules).
 */
export function normalizeStructuredFinding(input: unknown): StructuredFinding {
  const parsed = structuredFindingSchema.safeParse(input);
  const base = parsed.success ? parsed.data : coercePartialFinding(input);

  const fill = (s: string, fallback: string) => (s.trim().length ? s.trim() : fallback);

  const confidence: AnalysisConfidence = CONFIDENCE_VALUES.includes(base.confidence as AnalysisConfidence)
    ? (base.confidence as AnalysisConfidence)
    : "low";

  const classification = normalizeClassification(base.classification);

  return {
    finding_answer: fill(base.finding_answer, STRING_FALLBACKS.finding_answer),
    evidence_basis: fill(base.evidence_basis, STRING_FALLBACKS.evidence_basis),
    confidence,
    classification,
    reasoning: fill(base.reasoning, STRING_FALLBACKS.reasoning),
    limitations: fill(base.limitations, STRING_FALLBACKS.limitations),
    next_step: fill(base.next_step, STRING_FALLBACKS.next_step),
  };
}
