/**
 * Redaction analysis — prompt text lives in `prompts/redaction-analysis.ts`;
 * normalization lives in `lib/schemas/redaction-analysis-schema.ts`;
 * classification enforcement lives in `services/analysis-finding-validation.ts`.
 */
export {
  REDACTION_ANALYSIS_RULES,
  REDACTION_STRUCTURED_JSON_BLOCK,
} from "@/prompts/redaction-analysis";

export {
  normalizeRedactionAnalysisDetail,
  redactionAnalysisDetailSchema,
} from "@/lib/schemas/redaction-analysis-schema";
