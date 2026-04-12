import { EVIDENCE_MARKER_STYLES, type EvidenceAssignmentMarkerKind } from "@/lib/evidence-assignment-marker";

const ORDER: EvidenceAssignmentMarkerKind[] = [
  "unassigned",
  "in_case",
  "multi_case",
  "analyzed",
  "problem",
];

export function EvidenceMarkerLegend({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-md border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-[11px] text-zinc-400 ${className ?? ""}`}
    >
      <p className="font-medium text-zinc-300 mb-1.5 uppercase tracking-wide">Markers</p>
      <ul className="space-y-1">
        {ORDER.map((k) => (
          <li key={k} className="flex items-start gap-2">
            <span
              className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${EVIDENCE_MARKER_STYLES[k].dot}`}
              aria-hidden
            />
            <span>
              <span className="text-zinc-200">{EVIDENCE_MARKER_STYLES[k].label}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
