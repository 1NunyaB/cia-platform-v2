import { isExtractionPlaceholderText } from "@/lib/extraction-messages";
import type { EvidenceProcessingStatus } from "@/types";

export const EXTRACTION_RECOVERY_EXTRACTED_MESSAGE =
  "Unable to extract text. Please open the file and view manually; it may need cropping.";

export const EXTRACTION_RECOVERY_ANALYSIS_MESSAGE =
  "No usable text was extracted. Open the file, crop if necessary, save, and re-run extraction.";

/** Any non-placeholder extracted characters count as readable for recovery UX. */
export function hasReadableExtractedSnippet(rawExtracted: string): boolean {
  const t = rawExtracted.trim();
  return t.length > 0 && !isExtractionPlaceholderText(rawExtracted);
}

/**
 * When true, show manual review / crop recovery (after extraction has effectively failed or produced no usable text).
 */
export function needsTextExtractionRecovery(params: {
  rawExtracted: string;
  extractionStatus: string;
  processingStatus: EvidenceProcessingStatus;
}): boolean {
  const { rawExtracted, extractionStatus, processingStatus } = params;
  if (hasReadableExtractedSnippet(rawExtracted)) return false;
  if (processingStatus === "extracting" || processingStatus === "pending") return false;

  const ex = String(extractionStatus ?? "pending").toLowerCase();
  if (ex === "pending" && processingStatus === "accepted") return false;

  if (isExtractionPlaceholderText(rawExtracted)) return true;
  if (ex === "retry_needed" || ex === "failed" || ex === "unavailable") return true;

  if (processingStatus === "complete") {
    if (ex === "ok" || ex === "limited" || ex === "low_confidence") {
      if (!rawExtracted.trim() || isExtractionPlaceholderText(rawExtracted)) return true;
    }
  }

  return false;
}
