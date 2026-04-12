/**
 * Case-wide investigation actions — aggregate context from multiple evidence files.
 * Output is still the same seven-field structured finding (validated + discipline rules).
 */
import { INVESTIGATION_ANALYSIS_SYSTEM } from "@/prompts/investigation-analysis";

export const CASE_INVESTIGATION_ACTION_KINDS = [
  "explain_relevance",
  "corroboration",
  "contradictions",
  "summarize_evidence",
  "group_related_evidence",
] as const;

export type CaseInvestigationActionKind = (typeof CASE_INVESTIGATION_ACTION_KINDS)[number];

const ACTION_FOCUS: Record<CaseInvestigationActionKind, string> = {
  explain_relevance:
    "Focus: explain why the listed materials matter to an investigation — what questions they help answer and what they do not establish. Tie statements to specific filenames or entity labels where possible.",
  corroboration:
    "Focus: identify where different sources or file excerpts support the same factual point (corroboration). Order candidates by match strength (exact → alias → repeated entities → time alignment → same-day vs within-12h → location → event → pattern similarity). For each link, state what matched, where, direct vs contextual, strong/moderate/weak, and source count. Correlation is not proof; never treat repetition alone as sufficient.",
  contradictions:
    "Focus: identify tensions, inconsistencies, or conflicts between sources. Prefer Uncertain or Inferred when differences may be explained by missing context. Do not treat speculation as fact.",
  summarize_evidence:
    "Focus: produce a concise, evidence-grounded overview of what the case materials show as a whole — what is established, what is unclear, and what is missing. No dramatic language.",
  group_related_evidence:
    "Focus: explain how items could be grouped (using cluster summaries and shared entities/topics). Describe cross-type linkage cautiously; filename is metadata only — rely on described content and entities. Rank grouping rationale by strength; weak lexical overlap alone should stay weak.",
};

export function buildCaseInvestigationSystemPrompt(action: CaseInvestigationActionKind): string {
  return `${INVESTIGATION_ANALYSIS_SYSTEM}

You are performing a CASE-LEVEL review (multiple files and structured metadata below). Tailor next_step to missing evidence, possible corroboration, contradictions, and this investigation action. Return ONLY a JSON object with these exact string keys (seven finding fields — no supplemental graph arrays required for this response):
finding_answer, evidence_basis, confidence, classification, reasoning, limitations, next_step

${ACTION_FOCUS[action]}

If the supplied extracts are empty or too thin, still return all seven keys with conservative classification (usually Uncertain) and honest limitations.`;
}
