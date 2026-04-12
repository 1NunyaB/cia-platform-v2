"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { EvidenceFile, EvidenceProcessingStatus } from "@/types";
import { resolveEvidenceMarker } from "@/lib/evidence-assignment-marker";
import { EvidenceAssignmentMarker } from "@/components/evidence-assignment-marker";
import { EvidenceMarkerLegend } from "@/components/evidence-marker-legend";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type EvidenceLibraryRow = EvidenceFile & {
  case_membership_count: number;
  has_ai_analysis: boolean;
};

type Tab = "all" | "unassigned" | "assigned";

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

  const filtered = useMemo(() => {
    if (tab === "all") return rows;
    if (tab === "unassigned") return rows.filter((r) => r.case_id == null && r.case_membership_count === 0);
    return rows.filter((r) => r.case_id != null || r.case_membership_count > 0);
  }, [rows, tab]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Evidence</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Upload files to the <strong className="text-zinc-300 font-medium">database</strong> without a case, or add
            evidence inside a case workspace. Markers show assignment and analysis state.
          </p>
        </div>
        <EvidenceMarkerLegend className="max-w-[240px]" />
      </div>

      <form method="get" action="/evidence" className="flex flex-wrap items-center gap-2 rounded-md border border-zinc-800 bg-zinc-950/60 p-3">
        <Input
          name="q"
          defaultValue={initialQuery}
          placeholder="Search database — names, aliases, extracted text…"
          className="flex-1 min-w-[200px] bg-zinc-900 border-zinc-700"
        />
        <Button type="submit" size="sm" variant="secondary" className="bg-zinc-800 border border-zinc-600">
          Search
        </Button>
        {initialQuery ? (
          <Button type="button" size="sm" variant="ghost" asChild>
            <Link href="/evidence">Clear</Link>
          </Button>
        ) : null}
      </form>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All evidence"],
            ["unassigned", "Unassigned"],
            ["assigned", "Case evidence"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            type="button"
            size="sm"
            variant={tab === key ? "default" : "secondary"}
            className={tab === key ? "bg-sky-600 hover:bg-sky-500" : "bg-zinc-800 border border-zinc-700"}
            onClick={() => setTab(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      <Card className="border-zinc-800 bg-zinc-950/80">
        <CardHeader>
          <CardTitle className="text-base">Library ({filtered.length})</CardTitle>
          <CardDescription>Open a file to analyze, assign it to a case, or review metadata.</CardDescription>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No files in this filter yet.</p>
          ) : (
            <ul className="space-y-2">
              {filtered.map((r) => {
                const primary = evidencePrimaryLabel({
                  display_filename: r.display_filename ?? null,
                  original_filename: r.original_filename,
                });
                const kind = resolveEvidenceMarker({
                  caseId: r.case_id,
                  caseMembershipCount: r.case_membership_count,
                  processingStatus: r.processing_status as EvidenceProcessingStatus,
                  hasAiAnalysis: r.has_ai_analysis,
                });
                const href = r.case_id ? `/cases/${r.case_id}/evidence/${r.id}` : `/evidence/${r.id}`;
                return (
                  <li
                    key={r.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950/50 px-3 py-2"
                  >
                    <div className="flex items-start gap-2 min-w-0">
                      <span className="mt-1">
                        <EvidenceAssignmentMarker kind={kind} />
                      </span>
                      <div className="min-w-0">
                        <Link href={href} className="font-medium text-sky-400 hover:underline truncate block">
                          {primary}
                        </Link>
                        {r.short_alias ? (
                          <p className="text-[11px] font-mono text-zinc-500">{r.short_alias}</p>
                        ) : null}
                      </div>
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-zinc-500 shrink-0">
                      {r.case_id || r.case_membership_count > 0 ? "In case" : "Unassigned"}
                    </span>
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
