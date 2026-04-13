import {
  CONCEALED_USAGE_STRENGTH_LABELS,
  type ConcealedLanguageAnalysisDetail,
} from "@/types/analysis";

/**
 * Euphemism / possible coded-language review — dark surface consistent with other analysis panels.
 */
export function ConcealedLanguagePanel({ detail }: { detail: ConcealedLanguageAnalysisDetail }) {
  return (
    <div
      className="rounded-xl border border-border bg-white text-foreground shadow-sm"
      role="region"
      aria-label="Concealed language analysis"
    >
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Concealed language & euphemism review</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Flags unusual phrasing for review. Possible non-literal readings are hypotheses — not proven codes unless
          strongly corroborated in the extract and case context.
        </p>
      </div>
      <div className="px-4 py-4 border-b border-border space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Overview</p>
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{detail.overview}</p>
        <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{detail.case_only_scope_note}</p>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mt-3">Conservative summary</p>
        <p className="text-sm leading-relaxed text-foreground whitespace-pre-wrap">{detail.conservative_summary}</p>
      </div>
      {detail.flagged_phrases.length > 0 ? (
        <ul className="divide-y divide-border">
          {detail.flagged_phrases.map((row, i) => (
            <li key={i} className="px-4 py-4 space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-500/90">
                Flag {i + 1}
              </p>
              <ConcealedRow label="Flagged Phrase" value={row.flagged_phrase} emphasized />
              <ConcealedRow label="Why It Was Flagged" value={row.why_it_was_flagged} />
              <ConcealedRow label="Where It Appears" value={row.where_it_appears} />
              <ConcealedRow label="Occurrence" value={row.occurrence_summary} />
              <ConcealedRow
                label="Surrounding context (entities, dates, places, events)"
                value={row.surrounding_context}
              />
              <ConcealedRow label="Ordinary vs suspicious usage" value={row.ordinary_vs_suspicious} />
              <ConcealedRow label="Repeated Usage" value={row.repeated_usage} />
              <ConcealedRow label="Possible Non-Literal Meaning" value={row.possible_non_literal_meaning} />
              <ConcealedRow label="What Cannot Be Determined" value={row.what_cannot_be_determined} emphasized />
              <div className="pt-1">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Signal strength (model + rules){" "}
                </span>
                <span className="text-xs text-sky-200/90 border border-sky-500/35 rounded px-2 py-0.5">
                  {CONCEALED_USAGE_STRENGTH_LABELS[row.usage_strength]}
                </span>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 py-4 text-sm text-muted-foreground">No phrases flagged in this pass.</p>
      )}
    </div>
  );
}

function ConcealedRow({
  label,
  value,
  emphasized,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  return (
    <div className="sm:grid sm:grid-cols-[minmax(0,12rem)_1fr] sm:gap-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={
          emphasized
            ? "mt-1 sm:mt-0 text-sm text-foreground whitespace-pre-wrap font-medium"
            : "mt-1 sm:mt-0 text-sm text-foreground/95 whitespace-pre-wrap"
        }
      >
        {value}
      </dd>
    </div>
  );
}
