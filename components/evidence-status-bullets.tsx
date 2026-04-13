import {
  EVIDENCE_STATUS_BULLET_STYLES,
  type EvidenceStatusBulletKind,
} from "@/lib/evidence-status-bullets";

export function EvidenceStatusBullets({
  kinds,
  compact = false,
}: {
  kinds: EvidenceStatusBulletKind[];
  compact?: boolean;
}) {
  if (kinds.length === 0) return null;
  return (
    <span
      className={`inline-flex flex-wrap items-center gap-1.5 shrink-0 ${compact ? "max-w-[440px]" : ""}`}
      role="group"
      aria-label="Evidence status markers"
    >
      {kinds.map((k) => {
        const meta = EVIDENCE_STATUS_BULLET_STYLES[k];
        return (
          <span
            key={k}
            className={`inline-flex items-center gap-1 rounded-full border border-border bg-card px-2 py-0.5 ${
              compact ? "text-[10px]" : "text-[11px]"
            } font-medium text-foreground`}
            title={meta.label}
            aria-label={meta.label}
          >
            <span className={`inline-flex h-2 w-2 shrink-0 rounded-full ${meta.dot}`} />
            <span className="leading-none">{meta.label}</span>
          </span>
        );
      })}
    </span>
  );
}
