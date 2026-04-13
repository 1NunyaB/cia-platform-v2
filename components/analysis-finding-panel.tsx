import type { ReactNode } from "react";
import type { AuthenticityLabel, StructuredFinding } from "@/types/analysis";
import { STRUCTURED_FINDING_SECTIONS } from "@/lib/schemas/structured-finding";
import { AuthenticityBadge } from "@/components/authenticity-badge";
import { ClassificationBadge } from "@/components/classification-badge";
import { ConfidenceBadge } from "@/components/confidence-badge";

function valueForSection(
  finding: StructuredFinding,
  key: (typeof STRUCTURED_FINDING_SECTIONS)[number]["key"],
  badgesInHeader: boolean,
): ReactNode {
  switch (key) {
    case "confidence":
      return badgesInHeader ? (
        <span className="text-sm capitalize text-foreground">{finding.confidence}</span>
      ) : (
        <div className="pt-0.5">
          <ConfidenceBadge value={finding.confidence} />
        </div>
      );
    case "classification":
      return badgesInHeader ? (
        <span className="text-sm text-foreground">{finding.classification}</span>
      ) : (
        <div className="pt-0.5">
          <ClassificationBadge value={finding.classification} />
        </div>
      );
    default:
      return finding[key];
  }
}

/**
 * Default visible analysis: seven fields in fixed order (from STRUCTURED_FINDING_SECTIONS).
 */
export function AnalysisFindingPanel({
  finding,
  authenticityLabel,
  authenticityNotes,
}: {
  finding: StructuredFinding;
  /** When set, shows a compact badge strip with authenticity next to classification and confidence. */
  authenticityLabel?: AuthenticityLabel;
  authenticityNotes?: string;
}) {
  const showAuthStrip = authenticityLabel != null;

  return (
    <div
      className="rounded-xl border border-border bg-card text-foreground shadow-inner"
      role="region"
      aria-label="Structured analysis finding"
    >
      {showAuthStrip ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-panel px-4 py-2.5">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mr-1">
            Labels
          </span>
          <AuthenticityBadge value={authenticityLabel} />
          <ClassificationBadge value={finding.classification} />
          <ConfidenceBadge value={finding.confidence} />
        </div>
      ) : null}
      {authenticityNotes?.trim() ? (
        <p className="border-b border-border px-4 py-2 text-xs leading-relaxed text-muted-foreground whitespace-pre-wrap">
          {authenticityNotes.trim()}
        </p>
      ) : null}
      <dl className="divide-y divide-border">
        {STRUCTURED_FINDING_SECTIONS.map((row, i) => {
          const last = i === STRUCTURED_FINDING_SECTIONS.length - 1;
          const emphasized = row.variant === "emphasis";
          return (
            <FindingRow
              key={row.key}
              label={row.label}
              emphasized={emphasized}
              last={last}
              value={valueForSection(finding, row.key, showAuthStrip)}
            />
          );
        })}
      </dl>
    </div>
  );
}

function FindingRow({
  label,
  value,
  emphasized,
  last,
}: {
  label: string;
  value: ReactNode;
  emphasized?: boolean;
  last?: boolean;
}) {
  return (
    <div
      className={
        last
          ? "px-4 py-4 sm:grid sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4 rounded-b-xl"
          : "px-4 py-4 sm:grid sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4"
      }
    >
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={
          emphasized
            ? "mt-1 text-sm leading-relaxed text-foreground sm:mt-0 font-medium"
            : "mt-1 text-sm leading-relaxed text-foreground sm:mt-0 whitespace-pre-wrap"
        }
      >
        {value}
      </dd>
    </div>
  );
}
