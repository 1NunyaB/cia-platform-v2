import { cn } from "@/lib/utils";
import { EVIDENCE_KIND_LABEL, getEvidenceKindUiState } from "@/lib/evidence-kind";

type Row = {
  suggested_evidence_kind?: string | null;
  confirmed_evidence_kind?: string | null;
};

/**
 * Shows effective type (confirmed or suggested) and whether it is still "Suggested type" vs user-confirmed.
 * Separate from investigation stacks (People, Location, …).
 */
export function EvidenceKindBadge({
  row,
  className,
  compact = false,
}: {
  row: Row;
  className?: string;
  /** Tighter padding for dense lists. */
  compact?: boolean;
}) {
  const ui = getEvidenceKindUiState(row);
  const label = EVIDENCE_KIND_LABEL[ui.effective];

  return (
    <span className={cn("inline-flex flex-wrap items-center gap-1", className)}>
      <span
        className={cn(
          "inline-flex items-center rounded border border-sky-400/80 bg-sky-50 px-1.5 font-semibold text-sky-950",
          compact ? "py-0 text-[9px] uppercase tracking-wide" : "py-0.5 text-[10px] uppercase tracking-wide",
        )}
        title="Evidence type (Document / Image / Video / Audio) — not the same as case stacks"
      >
        {label}
      </span>
      {ui.isConfirmed ? (
        <span
          className={cn(
            "rounded border border-emerald-600/50 bg-emerald-50 px-1.5 font-medium text-emerald-950",
            compact ? "py-0 text-[9px]" : "py-0.5 text-[10px]",
          )}
          title="You confirmed this type"
        >
          Confirmed
        </span>
      ) : (
        <span
          className={cn(
            "rounded border border-amber-600/45 bg-amber-50/95 px-1.5 font-medium text-amber-950",
            compact ? "py-0 text-[9px]" : "py-0.5 text-[10px]",
          )}
          title="Suggested automatically from MIME/filename; open the file to confirm or reclassify"
        >
          Suggested type
        </span>
      )}
    </span>
  );
}
