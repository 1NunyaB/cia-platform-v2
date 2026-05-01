import {
  EVIDENCE_STATUS_BULLET_STYLES,
  type EvidenceStatusBulletKind,
} from "@/lib/evidence-status-bullets";

export function EvidenceStatusBullets({
  kinds,
  compact = false,
  emphasizeNeedsReviewUnopened = false,
}: {
  kinds: EvidenceStatusBulletKind[];
  compact?: boolean;
  /** Stronger “Needs reviewing” styling when the file has not been opened yet (triage cue, not an error). */
  emphasizeNeedsReviewUnopened?: boolean;
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
        const needsReviewPop = emphasizeNeedsReviewUnopened && k === "needs_analysis";
        return (
          <span
            key={k}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
              compact ? "text-[10px]" : "text-[11px]"
            } font-medium ${
              needsReviewPop
                ? "border-amber-400/80 bg-amber-500/15 text-amber-950 ring-1 ring-amber-400/50 dark:text-amber-50"
                : "border-border bg-card text-foreground"
            }`}
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
