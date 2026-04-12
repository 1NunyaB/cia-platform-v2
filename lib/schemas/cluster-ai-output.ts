import { z } from "zod";
import { authenticityLabelZodSchema, authenticityOptionalNotesZodSchema } from "@/lib/schemas/authenticity-schema";
import { structuredFindingSchema } from "@/lib/schemas/structured-finding";

/** Cluster “Analyze cluster” model response: seven finding fields + authenticity (same as file analysis). */
export const clusterAiModelOutputSchema = structuredFindingSchema.extend({
  authenticity_label: authenticityLabelZodSchema,
  authenticity_notes: authenticityOptionalNotesZodSchema,
  concealed_language_analysis: z.any().optional(),
});

export type ClusterAiModelOutput = z.infer<typeof clusterAiModelOutputSchema>;
