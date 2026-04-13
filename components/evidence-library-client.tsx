"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { EvidenceFile, EvidenceProcessingStatus } from "@/types";
import { resolveEvidenceStatusBullets } from "@/lib/evidence-status-bullets";
import { EvidenceStatusBullets } from "@/components/evidence-status-bullets";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";

export type EvidenceLibraryRow = EvidenceFile & {
  case_membership_count: number;
  has_ai_analysis: boolean;
  viewed: boolean;
  has_content_duplicate_peer: boolean;
};

type Tab = "all" | "unassigned" | "assigned";
type SubFilter = "none" | "needs_extract" | "needs_analyze";

export function EvidenceLibraryClient({
  rows,
  initialQuery = "",
}: {
  rows: EvidenceLibraryRow[];
  /** Active search (from `?q=`) — filenames, aliases, extracted text. */
  initialQuery?: string;
  casesForAssign?: { id: string; title: string }[];
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [subFilter, setSubFilter] = useState<SubFilter>("none");
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);

  function stageCompare(id: string) {
    if (compareA === id) {
      setCompareA(null);
      return;
    }
    if (compareB === id) {
      setCompareB(null);
      return;
    }
    if (!compareA) {
      setCompareA(id);
      return;
    }
    if (!compareB) {
      setCompareB(id);
      return;
    }
    setCompareA(id);
    setCompareB(null);
  }

  const filtered = useMemo(() => {
    function kindsForRow(r: EvidenceLibraryRow) {
      return resolveEvidenceStatusBullets({
        caseId: r.case_id,
        caseMembershipCount: r.case_membership_count,
        processingStatus: r.processing_status as EvidenceProcessingStatus,
        hasAiAnalysis: r.has_ai_analysis,
        viewed: r.viewed,
        hasContentDuplicatePeer: r.has_content_duplicate_peer,
        extractionStatus: r.extraction_status as string | null | undefined,
      });
    }
    let list =
      tab === "all"
        ? rows
        : tab === "unassigned"
          ? rows.filter((r) => r.case_id == null && r.case_membership_count === 0)
          : rows.filter((r) => r.case_id != null || r.case_membership_count > 0);

    if (subFilter === "needs_extract") {
      list = list.filter((r) => kindsForRow(r).includes("needs_extraction"));
    } else if (subFilter === "needs_analyze") {
      list = list.filter((r) => kindsForRow(r).includes("needs_analysis"));
    }
    return list;
  }, [rows, tab, subFilter]);

  const compareReady = compareA && compareB && compareA !== compareB;

  return (
    <div className="w-full space-y-6">
      <div className="min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Evidence library</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground">
            Your <strong className="font-semibold text-foreground">evidence database</strong> holds every file you can
            access. Assign items to an investigation for <strong className="font-semibold text-foreground">current case
            evidence</strong> on that case&apos;s workspace. Colored markers summarize assignment, extraction, and
            review state — filters help you organize and review without running AI.
          </p>
        </div>
      </div>

      <form
        method="get"
        action="/evidence"
        className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-panel p-3"
      >
        <Input
          name="q"
          defaultValue={initialQuery}
          placeholder="Search library — names, aliases, extracted text…"
          className="min-w-[200px] flex-1"
        />
        <Button type="submit" size="sm" variant="secondary">
          Search
        </Button>
        {initialQuery ? (
          <Button type="button" size="sm" variant="ghost" asChild>
            <Link href="/evidence">Clear</Link>
          </Button>
        ) : null}
      </form>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "Evidence library"],
              ["unassigned", "Unassigned evidence"],
              ["assigned", "On a case"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={tab === key ? "default" : "outline"}
              onClick={() => setTab(key)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Focus</span>
          {(
            [
              ["none", "All statuses"],
              ["needs_extract", "Needs extracting"],
              ["needs_analyze", "Needs analyzing"],
            ] as const
          ).map(([key, label]) => (
            <Button
              key={key}
              type="button"
              size="sm"
              variant={subFilter === key ? "secondary" : "ghost"}
              className={subFilter === key ? "border border-border" : ""}
              onClick={() => setSubFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {(compareA || compareB) && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-sky-300 bg-sky-50/95 px-3 py-2 text-sm text-foreground">
          <div className="min-w-0 space-y-1">
            <p className="font-medium">Select for compare</p>
            <p className="text-xs text-foreground/90">
              A: {compareA ? <code className="font-mono text-[11px]">{compareA.slice(0, 8)}…</code> : "—"} · B:{" "}
              {compareB ? <code className="font-mono text-[11px]">{compareB.slice(0, 8)}…</code> : "—"}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <Button type="button" size="sm" variant="outline" onClick={() => { setCompareA(null); setCompareB(null); }}>
              Clear
            </Button>
            {compareReady ? (
              <Button type="button" size="sm" asChild>
                <Link href={`/evidence/compare?a=${encodeURIComponent(compareA!)}&b=${encodeURIComponent(compareB!)}`}>
                  Open comparison
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      )}

      <Card className="border-border shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-base text-foreground">Library ({filtered.length})</CardTitle>
          <CardDescription className="leading-relaxed">
            Open a file to preview, extract text, run analysis, or assign to a case. Use markers and filters to triage
            work.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            rows.length === 0 ? (
              <EmptyState title="No evidence in your library yet">
                <p>
                  Use the upload section above to add files. Items stay here until you assign them to an investigation.
                </p>
              </EmptyState>
            ) : (
              <EmptyState title="Nothing matches this filter">
                <p>Try another tab or focus filter — your files are still in the library.</p>
              </EmptyState>
            )
          ) : (
            <ul className="space-y-2">
              {filtered.map((r) => {
                const primary = evidencePrimaryLabel({
                  display_filename: r.display_filename ?? null,
                  original_filename: r.original_filename,
                });
                const bullets = resolveEvidenceStatusBullets({
                  caseId: r.case_id,
                  caseMembershipCount: r.case_membership_count,
                  processingStatus: r.processing_status as EvidenceProcessingStatus,
                  hasAiAnalysis: r.has_ai_analysis,
                  viewed: r.viewed,
                  hasContentDuplicatePeer: r.has_content_duplicate_peer,
                  extractionStatus: r.extraction_status as string | null | undefined,
                });
                const href = r.case_id ? `/cases/${r.case_id}/evidence/${r.id}` : `/evidence/${r.id}`;
                const staged = r.id === compareA || r.id === compareB;
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-panel px-3 py-2.5"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <div className="min-w-0">
                        <Link
                          href={href}
                          className="block truncate font-medium text-primary underline-offset-2 hover:underline"
                        >
                          {primary}
                        </Link>
                        {r.short_alias ? (
                          <p className="font-mono text-[11px] text-muted-foreground">{r.short_alias}</p>
                        ) : null}
                        <div className="mt-1">
                          <EvidenceStatusBullets kinds={bullets} />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant={staged ? "default" : "outline"}
                        className="text-xs h-8"
                        onClick={() => stageCompare(r.id)}
                      >
                        {staged ? "Selected" : "Compare"}
                      </Button>
                      <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        {r.case_id || r.case_membership_count > 0 ? "On a case" : "Unassigned evidence"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
