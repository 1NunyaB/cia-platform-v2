import Link from "next/link";
import { AnalyzeButton } from "@/components/analyze-button";
import { ProcessingBadge } from "@/components/processing-badge";
import { Badge } from "@/components/ui/badge";
import type { AiAnalysis, EvidenceFile, EvidenceProcessingStatus } from "@/types";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";

function truncate(s: string, n: number) {
  const t = s.trim();
  if (t.length <= n) return t;
  return `${t.slice(0, n - 1)}…`;
}

export function CaseEvidenceRow({
  caseId,
  file,
  hasExtractedText,
  latestAnalysis,
}: {
  caseId: string;
  file: EvidenceFile;
  hasExtractedText: boolean;
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
          {latestAnalysis ? (
            <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
              AI analyzed
            </Badge>
          ) : null}
        </div>
        {sal ? (
          <p className="text-[11px] font-mono text-sky-400/90 mt-0.5">{sal}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          {file.mime_type ?? "unknown type"}
          {primary !== file.original_filename ? (
            <span className="block mt-0.5 text-[11px] text-zinc-500">Original: {file.original_filename}</span>
          ) : null}
        </p>
        {latestAnalysis?.summary ? (
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            <span className="text-foreground/80 font-medium">Summary: </span>
            {truncate(latestAnalysis.summary, 220)}
          </p>
        ) : hasExtractedText && !latestAnalysis ? (
          <p className="mt-2 text-xs text-muted-foreground">Extracted text ready — run analysis from this row or the file view.</p>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-stretch gap-1 sm:items-end">
        <AnalyzeButton evidenceId={file.id} />
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
