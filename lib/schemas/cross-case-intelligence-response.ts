import { z } from "zod";
import { structuredFindingSchema } from "@/lib/schemas/structured-finding";

/** Per–public-investigation attribution for read-only cross-case intelligence. */
export const crossCaseSourceSchema = z.object({
  case_id: z.string().uuid(),
  investigation_title: z.string(),
  verification: z.enum(["verified", "unverified"]),
  information_basis: z.enum(["confirmed_in_evidence", "inferred", "uncertain"]),
  attribution: z.string(),
});

/** Optional AI hint to propose an approved share (server still validates IDs). */
export const shareSuggestionSchema = z.discriminatedUnion("suggest", [
  z.object({ suggest: z.literal(false) }),
  z.object({
    suggest: z.literal(true),
    source_case_id: z.string().uuid(),
    evidence_file_id: z.string().uuid(),
    evidence_filename: z.string().min(1),
    share_summary_what: z.string().min(8),
    share_summary_why: z.string().min(8),
  }),
]);

export const crossCaseIntelligenceResponseSchema = structuredFindingSchema.extend({
  cross_case_sources: z.array(crossCaseSourceSchema).max(16).optional().default([]),
  share_suggestion: shareSuggestionSchema.optional(),
});

export type CrossCaseSourceParsed = z.infer<typeof crossCaseSourceSchema>;
export type ShareSuggestionParsed = z.infer<typeof shareSuggestionSchema>;
export type CrossCaseIntelligenceResponseParsed = z.infer<typeof crossCaseIntelligenceResponseSchema>;
