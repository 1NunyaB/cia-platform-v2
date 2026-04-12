"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, GitCompare, Microscope, LayoutList, ChevronRight, Loader2 } from "lucide-react";
import { INVESTIGATION_ACTION_GROUPS } from "@/lib/investigation-actions-config";
import type { InvestigationActionItem } from "@/lib/investigation-actions-config";
import type { CaseInvestigationActionKind } from "@/prompts/investigation-case-actions";
import type { StructuredFinding } from "@/types/analysis";
import { AnalysisFindingPanel } from "@/components/analysis-finding-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const GROUP_ICONS = {
  search: Search,
  compare: GitCompare,
  analyze: Microscope,
  build: LayoutList,
} as const;

function StatusBadge({ status }: { status: InvestigationActionItem["status"] }) {
  if (status === "available") {
    return (
      <span className="text-[10px] font-medium uppercase tracking-wide text-emerald-400/95">Ready</span>
    );
  }
  if (status === "partial") {
    return (
      <span className="text-[10px] font-medium uppercase tracking-wide text-sky-400/95">Partial</span>
    );
  }
  return (
    <span className="text-[10px] font-medium uppercase tracking-wide text-amber-400/90">Coming Soon</span>
  );
}

function resolveHref(
  caseId: string,
  item: InvestigationActionItem,
  opts: { q: string; firstEvidenceId: string | null },
): string | null {
  if (!item.href) return null;
  const q = encodeURIComponent(opts.q.trim());
  const intentQs = item.intent ? `intent=${encodeURIComponent(item.intent)}` : "";

  switch (item.href) {
    case "entities":
      return opts.q.trim() ? `/cases/${caseId}/entities?q=${q}` : `/cases/${caseId}/entities`;
    case "timeline":
      return opts.q.trim() ? `/cases/${caseId}/timeline?q=${q}` : `/cases/${caseId}/timeline`;
    case "clusters":
      return `/cases/${caseId}#evidence-clusters`;
    case "evidence-first": {
      if (opts.firstEvidenceId) {
        const base = `/cases/${caseId}/evidence/${opts.firstEvidenceId}`;
        return intentQs ? `${base}?${intentQs}` : base;
      }
      return `/cases/${caseId}#case-evidence`;
    }
    default:
      if (item.href.startsWith("#")) {
        return `/cases/${caseId}${item.href}`;
      }
      return `/cases/${caseId}/${item.href}`;
  }
}

export function InvestigationActionsPanel({
  caseId,
  firstEvidenceId,
  hasEvidence,
}: {
  caseId: string;
  firstEvidenceId: string | null;
  hasEvidence: boolean;
}) {
  const [q, setQ] = useState("");
  const [caseFinding, setCaseFinding] = useState<StructuredFinding | null>(null);
  const [caseError, setCaseError] = useState<string | null>(null);
  const [caseLoading, setCaseLoading] = useState<CaseInvestigationActionKind | null>(null);
  const [caseResultLabel, setCaseResultLabel] = useState<string | null>(null);
  const [caseErrorFallbackHref, setCaseErrorFallbackHref] = useState<string | null>(null);

  const searchContext = useMemo(
    () => ({ q, firstEvidenceId: firstEvidenceId ?? null }),
    [q, firstEvidenceId],
  );

  async function runCaseAnalysis(
    action: CaseInvestigationActionKind,
    label: string,
    fallback?: InvestigationActionItem["caseAnalysisFallback"],
  ) {
    setCaseLoading(action);
    setCaseResultLabel(label);
    setCaseError(null);
    setCaseFinding(null);
    setCaseErrorFallbackHref(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/investigation-action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = (await res.json()) as { error?: string; finding?: StructuredFinding };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : `Request failed (${res.status})`);
      }
      if (!data.finding) {
        throw new Error("Invalid response from server");
      }
      setCaseFinding(data.finding);
    } catch (e) {
      setCaseError(e instanceof Error ? e.message : "Analysis failed");
      setCaseFinding(null);
      if (fallback?.href) {
        const href = resolveHref(caseId, {
          id: "case-analysis-fallback",
          label: "",
          hover: "",
          status: "partial",
          href: fallback.href,
          intent: fallback.intent,
        }, searchContext);
        setCaseErrorFallbackHref(href);
      }
    } finally {
      setCaseLoading(null);
    }
  }

  return (
    <Card
      id="investigation-actions"
      className="border-zinc-800 bg-zinc-950/80 shadow-lg ring-1 ring-zinc-800/80"
    >
      <CardHeader className="pb-3 border-b border-zinc-800/90">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-zinc-900 p-2 border border-zinc-700">
            <LayoutList className="h-5 w-5 text-sky-400" aria-hidden />
          </div>
          <div>
            <CardTitle className="text-lg tracking-tight">Investigation Actions</CardTitle>
            <CardDescription className="text-muted-foreground text-sm mt-1">
              Guided shortcuts — search, compare, analyze, and build. Structured AI uses the seven-field finding on each
              file. Coming Soon means the control is visible but the full workflow is not shipped yet.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Quick find</p>
          <div className="flex flex-col gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, date, email, place, keyword…"
              className="bg-zinc-950 border-zinc-700 text-foreground placeholder:text-muted-foreground h-9 text-sm"
              aria-label="Quick search keywords for this case"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="bg-zinc-800/90 text-foreground border border-zinc-700 hover:bg-zinc-700"
                asChild
              >
                <Link
                  href={
                    q.trim()
                      ? `/cases/${caseId}/entities?q=${encodeURIComponent(q.trim())}`
                      : `/cases/${caseId}/entities`
                  }
                >
                  Entities
                </Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="bg-zinc-800/90 text-foreground border border-zinc-700 hover:bg-zinc-700"
                asChild
              >
                <Link
                  href={
                    q.trim()
                      ? `/cases/${caseId}/timeline?q=${encodeURIComponent(q.trim())}`
                      : `/cases/${caseId}/timeline`
                  }
                >
                  Timeline
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {INVESTIGATION_ACTION_GROUPS.map((group, gi) => {
          const Icon = GROUP_ICONS[group.id];
          return (
            <details
              key={group.id}
              className="group rounded-lg border border-zinc-800/90 bg-zinc-950/40 open:bg-zinc-950/60"
              open={gi === 0}
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm font-semibold text-foreground hover:bg-zinc-900/50 rounded-lg [&::-webkit-details-marker]:hidden">
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90" />
                <Icon className="h-4 w-4 shrink-0 text-sky-500/90" aria-hidden />
                <span className="flex-1 text-left">{group.sectionTitle}</span>
              </summary>
              <div className="px-3 pb-3 pt-0 space-y-1.5 border-t border-zinc-800/50">
                <p className="text-[11px] text-muted-foreground pt-2 pb-1">{group.sectionSubtitle}</p>
                <ul className="space-y-1.5">
                  {group.actions.map((item) => {
                    const href = resolveHref(caseId, item, searchContext);
                    const planned = item.status === "planned";
                    const noEvidenceHint = item.href === "evidence-first" && !hasEvidence;
                    const title = item.hover;
                    const analysisKind = item.caseAnalysisAction;
                    const analysisBusy = caseLoading !== null;

                    return (
                      <li key={item.id}>
                        {planned ? (
                          <button
                            type="button"
                            disabled
                            title={title}
                            className="flex w-full min-h-[2.75rem] flex-col gap-0.5 rounded-md border border-zinc-800/80 bg-zinc-950/30 px-2 py-2 text-left cursor-not-allowed opacity-75"
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                              <StatusBadge status={item.status} />
                            </span>
                            <span className="text-[11px] text-muted-foreground">{item.hover}</span>
                          </button>
                        ) : analysisKind ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title={title}
                            disabled={analysisBusy}
                            onClick={() => void runCaseAnalysis(analysisKind, item.label, item.caseAnalysisFallback)}
                            className={cn(
                              "h-auto min-h-[2.75rem] w-full justify-start gap-2 py-2 px-2 text-left font-normal",
                              "hover:bg-zinc-800/80 text-foreground border border-transparent hover:border-zinc-700",
                            )}
                          >
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium leading-tight">{item.label}</span>
                                <span className="flex items-center gap-1.5 shrink-0">
                                  {caseLoading === analysisKind ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-hidden />
                                  ) : null}
                                  <StatusBadge status={item.status} />
                                </span>
                              </span>
                              <span className="text-[11px] text-muted-foreground line-clamp-2">{item.hover}</span>
                            </span>
                          </Button>
                        ) : href ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-auto min-h-[2.75rem] w-full justify-start gap-2 py-2 px-2 text-left font-normal",
                              "hover:bg-zinc-800/80 text-foreground border border-transparent hover:border-zinc-700",
                              noEvidenceHint && "opacity-90",
                            )}
                            asChild
                          >
                            <Link href={href} title={title}>
                              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                                <span className="flex items-center justify-between gap-2">
                                  <span className="text-sm font-medium leading-tight">{item.label}</span>
                                  <StatusBadge status={item.status} />
                                </span>
                                <span className="text-[11px] text-muted-foreground line-clamp-2">{item.hover}</span>
                              </span>
                            </Link>
                          </Button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            title={title}
                            className="flex w-full min-h-[2.75rem] flex-col gap-0.5 rounded-md border border-zinc-800/80 bg-zinc-950/30 px-2 py-2 text-left cursor-not-allowed opacity-75"
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-muted-foreground">{item.label}</span>
                              <StatusBadge status={item.status} />
                            </span>
                            <span className="text-[11px] text-muted-foreground">{item.hover}</span>
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            </details>
          );
        })}

        {(caseFinding || caseError) && (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 space-y-3 mt-1">
            {caseResultLabel ? (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{caseResultLabel}</p>
            ) : null}
            {caseError ? (
              <div className="space-y-1.5">
                <p className="text-sm text-red-400/95">{caseError}</p>
                {caseErrorFallbackHref ? (
                  <p className="text-[11px] text-muted-foreground">
                    <Link href={caseErrorFallbackHref} className="text-sky-400/95 underline underline-offset-2 hover:text-sky-300">
                      Open related workspace
                    </Link>
                  </p>
                ) : null}
              </div>
            ) : null}
            {caseFinding ? <AnalysisFindingPanel finding={caseFinding} /> : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
