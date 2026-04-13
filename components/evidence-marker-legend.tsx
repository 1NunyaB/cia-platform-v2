import {
  EVIDENCE_STATUS_BULLET_LEGEND_ORDER,
  EVIDENCE_STATUS_BULLET_STYLES,
} from "@/lib/evidence-status-bullets";

export function EvidenceMarkerLegend({ className }: { className?: string }) {
  return (
    <div
      className={`rounded-md border border-border bg-panel px-3 py-2 text-[11px] ${className ?? ""}`}
    >
      <p className="mb-2 font-semibold uppercase tracking-wide text-foreground">Markers</p>
      <ul className="space-y-1.5">
        {EVIDENCE_STATUS_BULLET_LEGEND_ORDER.map((k) => {
          const meta = EVIDENCE_STATUS_BULLET_STYLES[k];
          return (
            <li key={k} className="flex items-start gap-2">
              <span
                className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${meta.dot}`}
                aria-hidden
              />
              <span className="font-medium text-foreground">{meta.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
