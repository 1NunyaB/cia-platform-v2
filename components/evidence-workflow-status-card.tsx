import type { EvidenceProcessingStatus } from "@/types";
import { AnalyzeButton } from "@/components/analyze-button";
import { RunEvidenceExtractionButton } from "@/components/run-evidence-extraction-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Readable extraction vs analysis state for manual reviewers (upload is implied OK when this page loads).
 */
export function EvidenceWorkflowStatusCard({
  processingStatus,
  extractionStatus,
  hasDisplayableExtract,
  hasAnalysis,
  needsExtraction,
  evidenceId,
}: {
  processingStatus: EvidenceProcessingStatus;
  extractionStatus: string | null | undefined;
  hasDisplayableExtract: boolean;
  hasAnalysis: boolean;
  needsExtraction: boolean;
  evidenceId: string;
}) {
  const ex = String(extractionStatus ?? "pending").toLowerCase();
  const extractLine = hasDisplayableExtract
    ? "Extracted text is available for this file."
    : ex === "limited"
      ? "This appears to be primarily image/photo evidence. OCR found limited incidental text."
      : ex === "low_confidence"
        ? "This appears to be primarily image/photo evidence. OCR text is low-confidence."
    : ex === "failed" || ex === "unavailable" || ex === "retry_needed" || processingStatus === "error"
      ? "Extraction failed or needs a retry."
      : processingStatus === "extracting"
        ? "Extraction is running."
        : "No usable extracted text yet.";

  const analysisLine = ex === "limited" || ex === "low_confidence"
    ? "Use this as visual evidence first (scene/object review). You can still retry extraction after manual zoom/review."
    : !hasDisplayableExtract
    ? "Run extraction first; analysis uses extracted text."
    : hasAnalysis
      ? "AI analysis is on file."
      : "Analysis has not been run yet.";

  return (
    <Card className="border-border bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-foreground">Evidence processing</CardTitle>
        <CardDescription className="text-foreground/90">
          Upload, text extraction, and AI analysis are tracked separately. Extraction results are shared for everyone who
          can open this evidence.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-foreground">
        <div className="rounded-md border border-sky-200 bg-sky-50/90 px-3 py-2">
          <p className="font-semibold text-foreground">Upload</p>
          <p className="mt-0.5 text-foreground/95">File stored successfully.</p>
        </div>
        <div className="rounded-md border border-border bg-panel px-3 py-2 space-y-2">
          <p className="font-semibold text-foreground">Text extraction</p>
          <p className="text-foreground/95">{extractLine}</p>
          {needsExtraction ? (
            <RunEvidenceExtractionButton
              evidenceId={evidenceId}
              label={hasDisplayableExtract ? "Retry extraction" : "Extract now"}
              variant="default"
            />
          ) : hasDisplayableExtract ? (
            <p className="text-xs text-muted-foreground">No further extraction action needed unless you retry.</p>
          ) : null}
        </div>
        <div className="rounded-md border border-border bg-panel px-3 py-2 space-y-2">
          <p className="font-semibold text-foreground">AI analysis</p>
          <p className="text-foreground/95">{analysisLine}</p>
          {hasDisplayableExtract && !hasAnalysis ? (
            <AnalyzeButton evidenceId={evidenceId} />
          ) : hasAnalysis ? (
            <p className="text-xs text-muted-foreground">Analysis is available; use case panels for full detail.</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
