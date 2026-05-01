import type { EvidenceProcessingStatus } from "@/types";

/** Client-side mirror of `getEvidenceNeedsExtraction` using list-row fields only (no DB round-trip). */
export function evidenceRowNeedsExtraction(input: {
  processingStatus: EvidenceProcessingStatus;
  extractionStatus: string | null | undefined;
}): boolean {
  const ps = input.processingStatus;
  const ex = String(input.extractionStatus ?? "pending").toLowerCase();

  if (ps === "extracting") return false;
  if (ps === "blocked") return false;
  if (ex === "failed" || ex === "unavailable" || ex === "retry_needed" || ex === "limited" || ex === "low_confidence") return true;
  if (ps === "error") return true;
  if (ps === "accepted") return true;

  if (ps === "complete") {
    if (ex !== "ok") return true;
    return false;
  }

  if (ps === "pending" || ps === "scanning" || ps === "analyzing") {
    return false;
  }

  return ex !== "ok";
}

/**
 * True when the row would show the “Needs reviewing” marker (no AI analysis yet, past upload pipeline)
 * and the current user has not opened the file in the library/detail flow (`evidence_file_views`).
 * Used for subtle list/detail emphasis — not an error state.
 */
export function evidenceRowNeedsReviewUnopened(input: {
  processingStatus: EvidenceProcessingStatus;
  hasAiAnalysis: boolean;
  viewed: boolean;
}): boolean {
  return evidenceRowNeedsAnalyzing(input) && !input.viewed;
}

/** True when the file is stored and viewable but no AI analysis row exists (optional triage marker). */
export function evidenceRowNeedsAnalyzing(input: {
  processingStatus: EvidenceProcessingStatus;
  hasAiAnalysis: boolean;
}): boolean {
  if (input.hasAiAnalysis) return false;
  const ps = input.processingStatus;
  if (
    ps === "blocked" ||
    ps === "error" ||
    ps === "pending" ||
    ps === "scanning" ||
    ps === "extracting" ||
    ps === "analyzing"
  ) {
    return false;
  }
  return true;
}
