/** Structured AI output for evidence comparison (epistemic tags are required in the model JSON). */
export type EvidenceCompareInsight = {
  size_ratio: { summary: string; epistemic: "approximate" | "inferred" | "uncertain" };
  alignment: { suggestions: string[]; epistemic: "inferred" | "approximate" | "uncertain" };
  scaling_guidance: { text: string; epistemic: "approximate" | "inferred" | "uncertain" };
  similarities: { text: string; epistemic: "inferred" | "uncertain" };
  differences: { text: string; epistemic: "inferred" | "uncertain" };
};
