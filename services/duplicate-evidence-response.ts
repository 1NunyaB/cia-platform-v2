import type { EvidenceDuplicateError } from "@/lib/evidence-upload-errors";
import type { AppSupabaseClient } from "@/types";
import { getEvidenceNeedsExtraction } from "@/services/evidence-service";
import { extractTextForEvidence } from "@/services/text-extraction-service";

const DUPLICATE_MESSAGE =
  "This file already exists in your library. No new record was created and the file was not uploaded again.";

export type DuplicateEvidenceResponseBody = {
  duplicate: true;
  no_new_record: true;
  message: string;
  existing: import("@/lib/evidence-upload-errors").DuplicateEvidenceMatch;
  needs_extraction: boolean;
};

/**
 * JSON body for duplicate uploads/imports. Optionally kicks extraction for stuck `accepted` rows.
 */
export async function buildDuplicateEvidenceResponse(
  supabase: AppSupabaseClient,
  err: EvidenceDuplicateError,
  options?: { healStuckAccepted?: boolean },
): Promise<DuplicateEvidenceResponseBody> {
  const needs_extraction = await getEvidenceNeedsExtraction(supabase, err.existing.id);
  const heal = options?.healStuckAccepted !== false;
  if (heal && needs_extraction) {
    void extractTextForEvidence(supabase, err.existing.id, err.existing.mime_type ?? null).catch(() => {});
  }
  return {
    duplicate: true,
    no_new_record: true,
    message: DUPLICATE_MESSAGE,
    existing: err.existing,
    needs_extraction,
  };
}
