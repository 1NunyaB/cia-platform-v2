import type { AuthenticityLabel } from "@/types/analysis";
import { AUTHENTICITY_LABEL_DISPLAY } from "@/types/analysis";

const WARN_LABELS: AuthenticityLabel[] = ["inconsistent", "potentially_manipulated", "unverified"];

/**
 * Prominent authenticity line — separate from classification (no layout redesign).
 */
export function AuthenticityStrip({
  label,
  notes,
}: {
  label: AuthenticityLabel;
  notes?: string;
}) {
  const title = AUTHENTICITY_LABEL_DISPLAY[label];
  const warn = WARN_LABELS.includes(label);

  return (
    <div
      className={
        warn
          ? "rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          : "rounded-lg border border-border bg-panel px-4 py-3 text-sm text-foreground"
      }
      role="status"
      aria-label={`Evidence authenticity: ${title}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Authenticity</span>
        <span className={warn ? "font-medium text-amber-950" : "font-medium text-foreground"}>{title}</span>
        <span className="text-xs text-muted-foreground">(independent from classification)</span>
      </div>
      {notes ? (
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{notes}</p>
      ) : null}
    </div>
  );
}
