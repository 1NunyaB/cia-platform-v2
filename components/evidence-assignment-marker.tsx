import type { EvidenceAssignmentMarkerKind } from "@/lib/evidence-assignment-marker";
import { EVIDENCE_MARKER_STYLES } from "@/lib/evidence-assignment-marker";

export function EvidenceAssignmentMarker({
  kind,
  title,
}: {
  kind: EvidenceAssignmentMarkerKind;
  /** Optional override; defaults to legend label for this kind. */
  title?: string;
}) {
  const meta = EVIDENCE_MARKER_STYLES[kind];
  return (
    <span
      className="inline-flex h-2 w-2 shrink-0 rounded-full"
      title={title ?? meta.label}
      aria-label={title ?? meta.label}
    >
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
    </span>
  );
}
