/**
 * Canonical priority order for all structured analysis outputs (evidence, case-level, cluster).
 * Enforced in prompts + post-processing (`enforceFindingDiscipline`).
 */
export const ANALYSIS_PRIORITY_DOCTRINE = `Strict output priorities (apply top-down; never violate a higher priority for a lower one):

1. Accuracy — Do not state or imply facts that the supplied evidence does not support. Never present assumptions, guesses, or hypotheticals as established fact.

2. Evidence support — Every finding must be traceable to evidence_basis (quotes, paraphrase of visible text, or explicit description of what the extract shows). If support is weak, downgrade classification and confidence; strengthen limitations instead of stretching the claim.

3. Conservative interpretation — Prefer Uncertain or Inferred over Confirmed when support is partial. Reserve Conclusive for claims that are fully and directly supported by unredacted, verifiable text; never treat redacted spans, placeholders, or inferred “recovery” of hidden wording as sufficient for Conclusive. Use Correlated when different evidence types or files align in a pattern but proof is not at the Confirmed bar. Never use speculative or assumption-led language with Confirmed.

4. Clarity — Be direct and concise. Avoid vague filler, hedging stacks, or dramatic wording. Each field should earn its space.

5. Organization — Output exactly the seven required keys (finding_answer, evidence_basis, confidence, classification, reasoning, limitations, next_step) with no alternate naming.

6. Actionable next_step — Must name concrete follow-ups: missing evidence to obtain, contradictions to reconcile, corroboration paths, or verification steps. Tailor next_step to the analysis context (single file vs whole case vs cluster) and to limitations already stated.

7. Search & correlation — When linking entities, times, places, or files, follow the platform’s match-priority and strength-labeling rules in the investigation system prompt; correlation supports inquiry but is not proof by itself.`;

export type AnalysisPipelineScope = "evidence_file" | "case_investigation" | "evidence_cluster";

/**
 * Optional context so post-validation can shape next_step and limitation emphasis.
 */
export type AnalysisPipelineContext = {
  scope: AnalysisPipelineScope;
  /** When scope is case_investigation — e.g. explain_relevance, corroboration */
  caseAction?: string;
};

export const DEFAULT_ANALYSIS_CONTEXT: AnalysisPipelineContext = {
  scope: "evidence_file",
};
