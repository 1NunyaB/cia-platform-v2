import { z } from "zod";
import type { RedactionAnalysisDetail } from "@/types/analysis";

/** Strict schema for validation when all fields are known to be present. */
export const redactionAnalysisDetailSchema = z.object({
  visible_context: z.string(),
  redacted_portion_impact: z.string(),
  likely_meaning: z.string(),
  what_cannot_be_determined: z.string(),
  unredacted_elsewhere_note: z.string(),
  context_interpretation_warning: z.string(),
});

const KEYS: (keyof RedactionAnalysisDetail)[] = [
  "visible_context",
  "redacted_portion_impact",
  "likely_meaning",
  "what_cannot_be_determined",
  "unredacted_elsewhere_note",
  "context_interpretation_warning",
];

const PLACEHOLDER = "—";

/**
 * Coerce partial model output into a complete block. Returns null if the model omitted the object or sent no content.
 */
export function normalizeRedactionAnalysisDetail(input: unknown): RedactionAnalysisDetail | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  let anyNonEmpty = false;
  const out = {} as RedactionAnalysisDetail;
  for (const k of KEYS) {
    const raw = o[k as string];
    const s = typeof raw === "string" ? raw.trim() : typeof raw === "number" ? String(raw).trim() : "";
    if (s.length > 1) anyNonEmpty = true;
    out[k] = s.length > 0 ? s : PLACEHOLDER;
  }
  if (!anyNonEmpty) return null;
  return out;
}
