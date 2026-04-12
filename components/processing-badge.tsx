import { Badge } from "@/components/ui/badge";
import type { EvidenceProcessingStatus } from "@/types";

const labels: Record<EvidenceProcessingStatus, string> = {
  pending: "Pending",
  scanning: "Scanning",
  accepted: "Accepted",
  blocked: "Blocked",
  extracting: "Extracting",
  analyzing: "Analyzing",
  complete: "Complete",
  error: "Error",
};

export function ProcessingBadge({ status }: { status: EvidenceProcessingStatus }) {
  const variant =
    status === "error" || status === "blocked"
      ? "destructive"
      : status === "complete"
        ? "secondary"
        : "default";
  return <Badge variant={variant}>{labels[status]}</Badge>;
}
