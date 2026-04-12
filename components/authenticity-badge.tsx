import { normalizeAuthenticityLabel } from "@/lib/schemas/authenticity-schema";
import { cn } from "@/lib/utils";
import { AUTHENTICITY_LABEL_DISPLAY, type AuthenticityLabel } from "@/types/analysis";

const HIGH: AuthenticityLabel[] = ["verified_by_source", "strongly_corroborated"];
const MID: AuthenticityLabel[] = ["likely_authentic"];

const styles: Record<"high" | "mid" | "low", string> = {
  high: "bg-emerald-500/15 text-emerald-100 border-emerald-500/45",
  mid: "bg-sky-500/15 text-sky-100 border-sky-500/40",
  low: "bg-amber-500/12 text-amber-100/95 border-amber-500/45",
};

function tier(label: AuthenticityLabel): "high" | "mid" | "low" {
  if (HIGH.includes(label)) return "high";
  if (MID.includes(label)) return "mid";
  return "low";
}

/**
 * Provenance / integrity badge — independent from analytical classification.
 */
export function AuthenticityBadge({
  value,
  className,
}: {
  value: AuthenticityLabel | string;
  className?: string;
}) {
  const slug = normalizeAuthenticityLabel(value);
  const label = AUTHENTICITY_LABEL_DISPLAY[slug];
  const t = tier(slug);

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
        styles[t],
        className,
      )}
      title="Evidence authenticity (separate from classification)"
    >
      {label}
    </span>
  );
}
