"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { EvidenceClusterRow } from "@/services/case-investigation-query";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";
import type { ClusterAnalysisView, StructuredFinding } from "@/types/analysis";
import { AnalysisFindingPanel } from "@/components/analysis-finding-panel";
import { ConcealedLanguagePanel } from "@/components/concealed-language-panel";
import { Button } from "@/components/ui/button";

export function EvidenceClusterBlock({
  caseId,
  cluster,
  initialAnalysis,
}: {
  caseId: string;
  cluster: EvidenceClusterRow;
  initialAnalysis?: ClusterAnalysisView | null;
}) {
  const router = useRouter();
  const [analysis, setAnalysis] = useState<ClusterAnalysisView | null>(initialAnalysis ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const members = cluster.evidence_cluster_members ?? [];
  const n = members.length;

  async function runAnalyze() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/clusters/${cluster.id}/analyze`, { method: "POST" });
      const data = (await res.json()) as {
        error?: string;
        finding?: StructuredFinding;
        authenticityLabel?: ClusterAnalysisView["authenticityLabel"];
        authenticityNotes?: string;
        concealedLanguageAnalysis?: ClusterAnalysisView["concealedLanguageAnalysis"];
      };
      if (!res.ok) {
        throw new Error(data.error ?? "Analysis failed");
      }
      if (data.finding) {
        setAnalysis({
          finding: data.finding,
          authenticityLabel: data.authenticityLabel ?? "unverified",
          ...(data.authenticityNotes ? { authenticityNotes: data.authenticityNotes } : {}),
          ...(data.concealedLanguageAnalysis
            ? { concealedLanguageAnalysis: data.concealedLanguageAnalysis }
            : {}),
        });
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <li className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-foreground space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2 gap-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{cluster.title ?? "Untitled cluster"}</span>
          {cluster.cluster_kind === "alias_focused" ? (
            <span
              className="text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded border border-amber-500/40 text-amber-400/95 bg-amber-500/5"
              title="Cluster driven primarily by identity / alias linkage across sources"
            >
              Alias-focused
            </span>
          ) : null}
        </div>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {n} file{n === 1 ? "" : "s"}
        </span>
      </div>
      {cluster.rationale ? (
        <p className="text-xs text-muted-foreground leading-relaxed">{cluster.rationale}</p>
      ) : null}
      <ul className="flex flex-wrap gap-2" aria-label="Linked evidence files">
        {members.map((m) => {
          const ef = m.evidence_files;
          const displayLabel =
            ef != null
              ? evidencePrimaryLabel({
                  display_filename: ef.display_filename ?? null,
                  original_filename: ef.original_filename,
                })
              : m.evidence_file_id;
          const shortAlias = ef?.short_alias?.trim();
          const eid = m.evidence_file_id;
          const aliasTrace = m.link_source === "alias_resolution";
          return (
            <li key={eid}>
              <Link
                href={`/cases/${caseId}/evidence/${eid}`}
                title={aliasTrace ? "Member linked via alias-resolution clustering" : undefined}
                className="inline-flex rounded border border-zinc-700/80 bg-zinc-900/50 px-2 py-1 text-xs text-sky-400 hover:bg-zinc-800 hover:underline"
              >
                {displayLabel}
                {shortAlias ? (
                  <span className="ml-1 text-zinc-500 font-normal">· {shortAlias}</span>
                ) : null}
                {aliasTrace ? (
                  <span className="ml-1 text-[10px] text-amber-400/90" aria-hidden>
                    · alias
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="bg-zinc-800 text-foreground border border-zinc-700"
          disabled={loading}
          onClick={() => void runAnalyze()}
        >
          {loading ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              Analyzing…
            </>
          ) : (
            "Analyze cluster"
          )}
        </Button>
        {error ? <span className="text-xs text-red-400">{error}</span> : null}
      </div>
      {analysis ? (
        <div className="pt-2 border-t border-zinc-800/90 space-y-4">
          <AnalysisFindingPanel
            finding={analysis.finding}
            authenticityLabel={analysis.authenticityLabel}
            authenticityNotes={analysis.authenticityNotes}
          />
          {analysis.concealedLanguageAnalysis ? (
            <ConcealedLanguagePanel detail={analysis.concealedLanguageAnalysis} />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}
