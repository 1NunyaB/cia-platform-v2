"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, GitCompare, Microscope, LayoutList, ChevronRight, Loader2, Globe, Share2 } from "lucide-react";
import { INVESTIGATION_ACTION_GROUPS } from "@/lib/investigation-actions-config";
import type { InvestigationActionItem } from "@/lib/investigation-actions-config";
import type { CaseInvestigationActionKind } from "@/prompts/investigation-case-actions";
import type { StructuredFinding } from "@/types/analysis";
import type { CrossCaseSourceParsed, ShareSuggestionParsed } from "@/lib/schemas/cross-case-intelligence-response";
import { AnalysisFindingPanel } from "@/components/analysis-finding-panel";
import { CrossCaseLabelLegend } from "@/components/cross-case-label-legend";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cisCaseForm, cisCasePage } from "@/lib/cis-case-page-shell";
import { cn } from "@/lib/utils";

const GROUP_ICONS = {
  search: Search,
  compare: GitCompare,
  analyze: Microscope,
  build: LayoutList,
} as const;

function basisLabel(b: CrossCaseSourceParsed["information_basis"]): string {
  switch (b) {
    case "confirmed_in_evidence":
      return "Confirmed in evidence";
    case "inferred":
      return "Inferred";
    case "uncertain":
      return "Uncertain";
    default:
      return b;
  }
}

function CrossCaseSourcesList({ sources }: { sources: CrossCaseSourceParsed[] }) {
  if (sources.length === 0) return null;
  return (
    <div className="space-y-2 border-t border-[#1e2d42] pt-1">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
        Other public investigations (read-only)
      </p>
      <ul className="space-y-2">
        {sources.map((s, i) => (
          <li
            key={`${s.case_id}-${i}`}
            className="rounded-md border border-[#1e2d42] bg-[#0f1623]/90 p-2.5 text-xs leading-snug text-slate-300"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={`/cases/${s.case_id}`}
                className="font-medium text-sky-400 underline-offset-2 hover:text-sky-300 hover:underline"
              >
                {s.investigation_title}
              </Link>
              <span
                className={cn(
                  "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                  s.verification === "verified"
                    ? "bg-emerald-950/35 text-emerald-100"
                    : "bg-amber-950/45 text-amber-50",
                )}
              >
                {s.verification}
              </span>
              <span className="rounded bg-slate-800/55 px-1.5 py-0.5 text-[10px] text-slate-200">
                {basisLabel(s.information_basis)}
              </span>
            </div>
            <p className="mt-1.5 text-slate-500">{s.attribution}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

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

  const [crossQuery, setCrossQuery] = useState("");
  const [crossFinding, setCrossFinding] = useState<StructuredFinding | null>(null);
  const [crossSources, setCrossSources] = useState<CrossCaseSourceParsed[]>([]);
  const [crossError, setCrossError] = useState<string | null>(null);
  const [crossLoading, setCrossLoading] = useState(false);
  const [shareSuggestion, setShareSuggestion] = useState<ShareSuggestionParsed | null>(null);
  const [shareProposalBusy, setShareProposalBusy] = useState(false);
  const [shareProposalNote, setShareProposalNote] = useState<string | null>(null);

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

  async function runCrossCaseIntelligence() {
    const cq = crossQuery.trim();
    if (cq.length < 8) {
      setCrossError("Enter at least 8 characters for a cross-investigation question.");
      setCrossFinding(null);
      setCrossSources([]);
      return;
    }
    setCrossLoading(true);
    setCrossError(null);
    setCrossFinding(null);
    setCrossSources([]);
    setShareSuggestion(null);
    setShareProposalNote(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/cross-intelligence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: cq }),
      });
      const data = (await res.json()) as {
        error?: string;
        finding?: StructuredFinding;
        cross_case_sources?: CrossCaseSourceParsed[];
        share_suggestion?: ShareSuggestionParsed;
      };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : `Request failed (${res.status})`);
      }
      if (!data.finding) {
        throw new Error("Invalid response from server");
      }
      setCrossFinding(data.finding);
      setCrossSources(Array.isArray(data.cross_case_sources) ? data.cross_case_sources : []);
      setShareProposalNote(null);
      setShareSuggestion(data.share_suggestion ?? { suggest: false });
    } catch (e) {
      setCrossError(e instanceof Error ? e.message : "Cross-investigation query failed");
      setCrossFinding(null);
      setCrossSources([]);
      setShareSuggestion(null);
    } finally {
      setCrossLoading(false);
    }
  }

  async function submitEvidenceShareProposal(s: Extract<ShareSuggestionParsed, { suggest: true }>) {
    setShareProposalBusy(true);
    setShareProposalNote(null);
    try {
      const res = await fetch(`/api/cases/${caseId}/evidence-share-proposals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_case_id: s.source_case_id,
          evidence_file_id: s.evidence_file_id,
          summary_what: s.share_summary_what,
          summary_why: s.share_summary_why,
        }),
      });
      const data = (await res.json()) as { error?: string; proposal_id?: string };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : `Request failed (${res.status})`);
      }
      setShareProposalNote(
        "Proposal created. Investigators on this case were notified — accept or decline under the bell icon in the header. Nothing is linked until someone accepts.",
      );
      setShareSuggestion({ suggest: false });
    } catch (e) {
      setShareProposalNote(e instanceof Error ? e.message : "Could not create share proposal");
    } finally {
      setShareProposalBusy(false);
    }
  }

  return (
    <Card id="investigation-actions" className={cn(cisCasePage.panel)}>
      <CardHeader className={cn("pb-3", cisCasePage.panelHeaderBorder)}>
        <div className="flex items-start gap-3">
          <div className="rounded-md border border-[#1e2d42] bg-[#0f1623] p-2">
            <LayoutList className="h-5 w-5 text-sky-400" aria-hidden />
          </div>
          <div>
            <CardTitle className={cn(cisCasePage.cardTitle, "text-lg")}>Investigation Actions</CardTitle>
            <CardDescription className={cn(cisCasePage.cardDescription, "mt-1 text-sm")}>
              Guided shortcuts — search, compare, analyze, and build. Structured AI uses the seven-field finding on each
              file. Coming Soon means the control is visible but the full workflow is not shipped yet.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 pt-4">
        <div className="space-y-2 rounded-lg border border-[#1e2d42] bg-[#0f1623]/80 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Quick find</p>
          <div className="flex flex-col gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, date, email, place, keyword…"
              className={cn(cisCaseForm.control, "h-9")}
              aria-label="Quick search keywords for this case"
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className={cisCasePage.secondaryBtn}
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
              <Button type="button" size="sm" variant="secondary" className={cisCasePage.secondaryBtn} asChild>
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

        <div className="space-y-2 rounded-lg border border-[#1e2d42] bg-[#0f1623]/80 p-3">
          <div className="flex items-start gap-2">
            <div className="shrink-0 rounded-md border border-[#1e2d42] bg-[#141e2e] p-1.5">
              <Globe className="h-4 w-4 text-sky-400" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Cross-investigation intelligence
              </p>
              <p className="text-[11px] leading-relaxed text-slate-500">
                Ask a question using this case plus read-only context from other{" "}
                <span className="font-medium text-slate-200">public</span> investigations (matched by keywords). No
                private notes or restricted data. Nothing is copied between cases automatically.
              </p>
            </div>
          </div>
          <CrossCaseLabelLegend />
          <Textarea
            value={crossQuery}
            onChange={(e) => setCrossQuery(e.target.value)}
            placeholder="e.g. Have we seen similar timelines or weapons in other public cases?"
            className={cn(cisCaseForm.control, "min-h-[72px] resize-y")}
            aria-label="Question for cross-investigation read-only assistant"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className={cisCasePage.secondaryBtn}
            disabled={crossLoading}
            onClick={() => void runCrossCaseIntelligence()}
          >
            {crossLoading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
                Searching…
              </>
            ) : (
              "Ask with public cross-case context"
            )}
          </Button>
          {(crossFinding || crossError) && (
            <div className="mt-1 space-y-3 rounded-md border border-[#1e2d42] bg-[#111827]/90 p-3">
              {crossError ? <p className="text-sm font-medium text-red-400">{crossError}</p> : null}
              {crossFinding ? (
                <>
                  <AnalysisFindingPanel finding={crossFinding} />
                  <CrossCaseSourcesList sources={crossSources} />
                  {shareSuggestion?.suggest === true ? (
                    <div className="space-y-2 rounded-md border border-amber-500/30 bg-amber-950/25 p-3">
                      <div className="flex items-start gap-2">
                        <Share2 className="mt-0.5 h-4 w-4 shrink-0 text-amber-200/90" aria-hidden />
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm font-medium text-white">
                            This information may be useful to another investigation. Would you like to share it?
                          </p>
                          <p className="text-[11px] leading-relaxed text-slate-500">
                            This would create a <span className="font-medium text-slate-200">proposal</span> to link{" "}
                            <span className="text-slate-200">{shareSuggestion.evidence_filename}</span> from the public
                            investigation{" "}
                            <Link
                              href={`/cases/${shareSuggestion.source_case_id}`}
                              className="font-medium text-sky-400 underline underline-offset-2 hover:text-sky-300"
                            >
                              (open case)
                            </Link>{" "}
                            into <span className="font-medium text-slate-200">this</span> investigation. No file is copied
                            and nothing changes until a teammate accepts the proposal in Notifications.
                          </p>
                          <div className="mt-2 space-y-1 border-t border-[#1e2d42]/80 pt-1 text-[11px]">
                            <p>
                              <span className="font-medium text-slate-300">What: </span>
                              {shareSuggestion.share_summary_what}
                            </p>
                            <p>
                              <span className="font-medium text-slate-300">Why relevant: </span>
                              {shareSuggestion.share_summary_why}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <Button
                          type="button"
                          size="sm"
                          className="border border-blue-600 bg-[#1e40af] text-white hover:bg-blue-600"
                          disabled={shareProposalBusy}
                          onClick={() => void submitEvidenceShareProposal(shareSuggestion)}
                        >
                          {shareProposalBusy ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : null}
                          Yes, create share proposal
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className={cisCasePage.secondaryBtn}
                          disabled={shareProposalBusy}
                          onClick={() => setShareSuggestion({ suggest: false })}
                        >
                          No thanks
                        </Button>
                      </div>
                      {shareProposalNote ? <p className="pt-1 text-xs text-slate-500">{shareProposalNote}</p> : null}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          )}
        </div>

        {INVESTIGATION_ACTION_GROUPS.map((group, gi) => {
          const Icon = GROUP_ICONS[group.id];
          return (
            <details
              key={group.id}
              className="group rounded-lg border border-[#1e2d42] bg-[#0f1623]/70 open:bg-[#111827]/90"
              open={gi === 0}
            >
              <summary className="flex cursor-pointer list-none items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold text-slate-100 hover:bg-[#1a2335]/80 [&::-webkit-details-marker]:hidden">
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90" />
                <Icon className="h-4 w-4 shrink-0 text-sky-400" aria-hidden />
                <span className="flex-1 text-left">{group.sectionTitle}</span>
              </summary>
              <div className="space-y-1.5 border-t border-[#1e2d42] px-3 pb-3 pt-0">
                <p className="pb-1 pt-2 text-[11px] text-slate-500">{group.sectionSubtitle}</p>
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
                            className="flex min-h-[2.75rem] w-full cursor-not-allowed flex-col gap-0.5 rounded-md border border-[#1e2d42] bg-[#141e2e]/60 px-2 py-2 text-left opacity-75"
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-slate-500">{item.label}</span>
                              <StatusBadge status={item.status} />
                            </span>
                            <span className="text-[11px] text-slate-600">{item.hover}</span>
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
                              "h-auto min-h-[2.75rem] w-full justify-start gap-2 px-2 py-2 text-left font-normal",
                              "border border-transparent text-slate-200 hover:border-[#334155] hover:bg-[#1a2335]",
                            )}
                          >
                            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                              <span className="flex items-center justify-between gap-2">
                                <span className="text-sm font-medium leading-tight">{item.label}</span>
                                <span className="flex shrink-0 items-center gap-1.5">
                                  {caseLoading === analysisKind ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" aria-hidden />
                                  ) : null}
                                  <StatusBadge status={item.status} />
                                </span>
                              </span>
                              <span className="line-clamp-2 text-[11px] text-slate-500">{item.hover}</span>
                            </span>
                          </Button>
                        ) : href ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                              "h-auto min-h-[2.75rem] w-full justify-start gap-2 px-2 py-2 text-left font-normal",
                              "border border-transparent text-slate-200 hover:border-[#334155] hover:bg-[#1a2335]",
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
                                <span className="line-clamp-2 text-[11px] text-slate-500">{item.hover}</span>
                              </span>
                            </Link>
                          </Button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            title={title}
                            className="flex min-h-[2.75rem] w-full cursor-not-allowed flex-col gap-0.5 rounded-md border border-[#1e2d42] bg-[#141e2e]/60 px-2 py-2 text-left opacity-75"
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span className="text-sm font-medium text-slate-500">{item.label}</span>
                              <StatusBadge status={item.status} />
                            </span>
                            <span className="text-[11px] text-slate-600">{item.hover}</span>
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
          <div className="mt-1 space-y-3 rounded-lg border border-[#1e2d42] bg-[#0f1623]/80 p-3">
            {caseResultLabel ? (
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{caseResultLabel}</p>
            ) : null}
            {caseError ? (
              <div className="space-y-1.5">
                <p className="text-sm font-medium text-red-400">{caseError}</p>
                {caseErrorFallbackHref ? (
                  <p className="text-[11px] text-slate-500">
                    <Link
                      href={caseErrorFallbackHref}
                      className="font-medium text-sky-400 underline underline-offset-2 hover:text-sky-300"
                    >
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
