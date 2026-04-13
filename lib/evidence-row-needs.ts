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

/** True when text extraction looks complete but AI analysis has not been run yet. */
export function evidenceRowNeedsAnalyzing(input: {
  processingStatus: EvidenceProcessingStatus;
  extractionStatus: string | null | undefined;
  hasAiAnalysis: boolean;
}): boolean {
  if (input.hasAiAnalysis) return false;
  const ps = input.processingStatus;
  if (ps === "blocked" || ps === "error") return false;
  const ex = String(input.extractionStatus ?? "").toLowerCase();
  return ps === "complete" && ex === "ok";
}
