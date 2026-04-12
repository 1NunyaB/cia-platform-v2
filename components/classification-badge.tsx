import { cn } from "@/lib/utils";
import { normalizeClassification, type AnalysisClassification } from "@/types/analysis";

const styles: Record<AnalysisClassification, string> = {
  Confirmed: "bg-sky-500/20 text-sky-100 border-sky-500/40",
  Inferred: "bg-violet-500/20 text-violet-100 border-violet-500/40",
  Reconstructed: "bg-orange-500/20 text-orange-100 border-orange-500/40",
  Uncertain: "bg-zinc-500/25 text-foreground border-zinc-500/45",
  Correlated: "bg-cyan-600/20 text-cyan-100 border-cyan-500/45",
  Conclusive: "bg-emerald-600/25 text-emerald-100 border-emerald-500/50",
};

/**
 * Renders only the six allowed classification labels; any other string is normalized to Uncertain.
 */
export function ClassificationBadge({ value }: { value: AnalysisClassification | string }) {
  const label = normalizeClassification(value);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold",
        styles[label],
      )}
    >
      {label}
    </span>
  );
}
