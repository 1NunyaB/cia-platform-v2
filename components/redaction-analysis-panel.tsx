import type { RedactionAnalysisDetail } from "@/types/analysis";

const ROWS: { key: keyof RedactionAnalysisDetail; label: string }[] = [
  { key: "visible_context", label: "Visible context" },
  { key: "redacted_portion_impact", label: "Redacted portion impact" },
  { key: "likely_meaning", label: "Likely meaning (interpretive — not hidden wording)" },
  { key: "what_cannot_be_determined", label: "What cannot be determined" },
  { key: "unredacted_elsewhere_note", label: "Unredacted elsewhere / corroboration" },
];

/**
 * Labeled redaction review — distinct from the seven-field finding so context-based interpretation is visibly separated.
 */
export function RedactionAnalysisPanel({ detail }: { detail: RedactionAnalysisDetail }) {
  return (
    <div
      className="rounded-xl border border-amber-500/25 bg-amber-950/10 text-foreground shadow-inner"
      role="region"
      aria-label="Redaction analysis"
    >
      <div className="border-b border-amber-500/20 px-4 py-3">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Redaction analysis</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Interpretive fields describe what is visible and what is uncertain — not exact recovery of blacked-out or
          withheld text.
        </p>
      </div>
      <dl className="divide-y divide-border">
        {ROWS.map((row) => (
          <div key={row.key} className="px-4 py-3 sm:grid sm:grid-cols-[minmax(0,12rem)_1fr] sm:gap-4">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{row.label}</dt>
            <dd className="mt-1 text-sm leading-relaxed text-foreground sm:mt-0 whitespace-pre-wrap">
              {detail[row.key]}
            </dd>
          </div>
        ))}
        <div className="px-4 py-3 sm:grid sm:grid-cols-[minmax(0,12rem)_1fr] sm:gap-4 bg-amber-950/25 rounded-b-xl">
          <dt className="text-xs font-semibold uppercase tracking-wide text-amber-200/90">Context warning</dt>
          <dd className="mt-1 text-sm leading-relaxed text-amber-100/95 sm:mt-0 whitespace-pre-wrap">
            {detail.context_interpretation_warning}
          </dd>
        </div>
      </dl>
    </div>
  );
}
