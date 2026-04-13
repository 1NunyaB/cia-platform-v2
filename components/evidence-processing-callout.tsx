import type { EvidenceProcessingStatus } from "@/types";

export function EvidenceProcessingCallout({
  status,
  errorMessage,
}: {
  status: EvidenceProcessingStatus;
  errorMessage: string | null | undefined;
}) {
  if (status === "extracting") {
    return (
      <div className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-foreground">
        <p className="font-medium text-foreground">Extracting text</p>
        <p className="mt-0.5 text-foreground/90">
          OCR and text extraction are running. Refresh or wait — status will change to Complete when done.
        </p>
      </div>
    );
  }
  if (status === "accepted") {
    return (
      <div className="rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-foreground">
        <p className="font-medium text-foreground">Processing</p>
        <p className="mt-0.5 text-foreground/90">
          File accepted — extraction should start immediately (Accepted → Extracting → Complete). If this stays on
          Accepted with no text, use &quot;Run extraction&quot; below.
        </p>
      </div>
    );
  }
  if (status === "error" && errorMessage) {
    return (
      <div className="rounded-lg border border-alert-border bg-alert px-4 py-3 text-sm text-alert-foreground">
        <p className="font-medium">Extraction error</p>
        <p className="mt-0.5">{errorMessage}</p>
      </div>
    );
  }
  return null;
}
