/** Shown after upload when the file is stored but extraction did not finish successfully. */
export const EXTRACTION_SOFT_FAILURE_CLIENT_MESSAGE =
  "Upload succeeded. Text extraction was not possible at this time — open the evidence file to inspect it, then try extraction again later.";

/** Shown when the user chose to skip immediate extraction — upload still succeeded. */
export const UPLOAD_DEFERRED_EXTRACTION_CLIENT_MESSAGE =
  "Upload saved. Text extraction was skipped for now — open the evidence file and use “Extract now” when you are ready.";

/** True when the API warning is the extraction soft-failure notice (vs URL fetch notes, etc.). */
export function isExtractionSoftFailureNotice(w: string | undefined): boolean {
  return Boolean(w && w.includes("Text extraction was not possible"));
}
