import type { EvidenceDuplicateError } from "@/lib/evidence-upload-errors";
import type { AppSupabaseClient } from "@/types";

const DUPLICATE_MESSAGE =
  "This file already exists in your library. No new record was created and your file was not uploaded again.";

export type DuplicateEvidenceResponseBody = {
  duplicate: true;
  no_new_record: true;
  message: string;
  existing: import("@/lib/evidence-upload-errors").DuplicateEvidenceMatch;
  /** Legacy field; kept for API compatibility. Always false — there is no separate extraction step. */
  needs_extraction: boolean;
};

/**
 * JSON body for duplicate uploads/imports.
 */
export async function buildDuplicateEvidenceResponse(
  _supabase: AppSupabaseClient,
  err: EvidenceDuplicateError,
): Promise<DuplicateEvidenceResponseBody> {
  return {
    duplicate: true,
    no_new_record: true,
    message: DUPLICATE_MESSAGE,
    existing: err.existing,
    needs_extraction: false,
  };
}
