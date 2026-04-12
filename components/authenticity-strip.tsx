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
          ? "rounded-lg border border-amber-500/35 bg-amber-500/[0.07] px-4 py-3 text-sm"
          : "rounded-lg border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm"
      }
      role="status"
      aria-label={`Evidence authenticity: ${title}`}
    >
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Authenticity</span>
        <span className={warn ? "font-medium text-amber-100/95" : "font-medium text-foreground"}>{title}</span>
        <span className="text-xs text-muted-foreground">(independent from classification)</span>
      </div>
      {notes ? (
        <p className="mt-2 text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{notes}</p>
      ) : null}
    </div>
  );
}
