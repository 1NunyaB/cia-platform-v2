import Link from "next/link";
import { ProcessingBadge } from "@/components/processing-badge";
import { Badge } from "@/components/ui/badge";
import { EvidenceKindBadge } from "@/components/evidence-kind-badge";
import { type AiAnalysis, type EvidenceFile, type EvidenceProcessingStatus } from "@/types";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";

function truncate(s: string, n: number) {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

export function CaseEvidenceRow({
  caseId,
  file,
  latestAnalysis,
}: {
  caseId: string;
  file: EvidenceFile;
  latestAnalysis?: AiAnalysis;
}) {
  const primary = evidencePrimaryLabel({
    display_filename: file.display_filename ?? null,
    original_filename: file.original_filename,
  });
  const sal = file.short_alias?.trim();

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border/60 bg-muted/5 px-3 py-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/cases/${caseId}/evidence/${file.id}`}
            className="font-medium text-foreground hover:underline"
          >
            {primary}
          </Link>
          <ProcessingBadge status={file.processing_status as EvidenceProcessingStatus} />
          <EvidenceKindBadge row={file} compact />
          {latestAnalysis ? (
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              AI analyzed
            </Badge>
          ) : null}
        </div>
        {sal ? (
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{sal}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {file.mime_type ?? "unknown type"}
          {primary !== file.original_filename ? (
            <span className="mt-0.5 block text-[11px] text-muted-foreground">Original: {file.original_filename}</span>
          ) : null}
        </p>
        {latestAnalysis?.summary ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            <span className="text-foreground/80 font-medium">Summary: </span>
            {truncate(latestAnalysis.summary, 220)}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end">
        <Link
          href={`/cases/${caseId}/evidence/${file.id}`}
          className="text-center text-xs text-primary hover:underline sm:text-right"
        >
          Open file
        </Link>
      </div>
    </li>
  );
}
