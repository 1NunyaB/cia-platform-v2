import { cn } from "@/lib/utils";
import type { AnalysisConfidence } from "@/types/analysis";

const styles: Record<AnalysisConfidence, string> = {
  high: "bg-emerald-500/20 text-emerald-200 border-emerald-500/40",
  medium: "bg-amber-500/20 text-amber-200 border-amber-500/40",
  low: "bg-rose-500/15 text-rose-200 border-rose-500/35",
};

export function ConfidenceBadge({ value }: { value: AnalysisConfidence }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
        styles[value],
      )}
    >
      {value}
    </span>
  );
}
