/**
 * Concealed-language analysis: normalization lives in `lib/schemas/concealed-language-schema.ts`.
 * Cross-file statistical detection is model-led in the investigation prompt (same-run supplemental hints);
 * the server enforces conservative classification via `enforceConcealedLanguageDiscipline`.
 */
export { normalizeConcealedLanguageAnalysis } from "@/lib/schemas/concealed-language-schema";
