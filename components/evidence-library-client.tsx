"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { EvidenceFile, EvidenceProcessingStatus } from "@/types";
import { resolveEvidenceStatusBullets } from "@/lib/evidence-status-bullets";
import { EvidenceStatusBullets } from "@/components/evidence-status-bullets";
import { EvidenceListThumbnail } from "@/components/evidence-list-thumbnail";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import {
  WORKSPACE_AI_DRAG_MIME,
  dispatchWorkspaceAiAttachEvidence,
} from "@/lib/workspace-evidence-ai-bridge";
import { type EvidenceKind } from "@/lib/evidence-kind";
import { EvidenceKindBadge } from "@/components/evidence-kind-badge";
import { EvidenceBulkActionBar } from "@/components/evidence-bulk-action-bar";

export type EvidenceLibraryRow = EvidenceFile & {
  case_membership_count: number;
  has_ai_analysis: boolean;
  viewed: boolean;
  has_content_duplicate_peer: boolean;
};

type Tab = "all" | "unassigned" | "assigned";

function libraryHref(query: string, kind: EvidenceKind | null) {
  const p = new URLSearchParams();
  const q = query.trim();
  if (q) p.set("q", q);
  if (kind) p.set("kind", kind);
  const s = p.toString();
  return s ? `/evidence?${s}` : "/evidence";
}

export function EvidenceLibraryClient({
  rows,
  initialQuery = "",
  activeKind = null,
  casesForAssign = [],
  signedIn = false,
}: {
  rows: EvidenceLibraryRow[];
  /** Active search (from `?q=`) — filenames, aliases, visual tags. */
  initialQuery?: string;
  /** From `?kind=` — browse by confirmed-or-suggested type. */
  activeKind?: EvidenceKind | null;
  casesForAssign?: { id: string; title: string }[];
  /** Bulk actions require an authenticated user. */
  signedIn?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("all");
  const [compareA, setCompareA] = useState<string | null>(null);
  const [compareB, setCompareB] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

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
    let list =
      tab === "all"
        ? rows
        : tab === "unassigned"
          ? rows.filter((r) => r.case_id == null && r.case_membership_count === 0)
          : rows.filter((r) => r.case_id != null || r.case_membership_count > 0);

    return list;
  }, [rows, tab]);

  const compareReady = compareA && compareB && compareA !== compareB;

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((r) => selected.has(r.id as string));

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllFiltered() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        for (const r of filtered) next.delete(r.id as string);
      } else {
        for (const r of filtered) next.add(r.id as string);
      }
      return next;
    });
  }

  return (
    <div className="w-full space-y-6">
      <div className="min-w-0">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Evidence Library</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground">
            Your <strong className="font-semibold text-foreground">evidence database</strong> holds every file you can
            access. Use <strong className="font-semibold text-foreground">Add to case</strong> to put files on an
            investigation for <strong className="font-semibold text-foreground">current case evidence</strong> on that
            case&apos;s workspace. Colored markers summarize assignment and review state —
            filters help you organize the list.
          </p>
        </div>
      </div>

      <form
        method="get"
        action="/evidence"
        className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-panel p-3"
      >
        {activeKind ? <input type="hidden" name="kind" value={activeKind} /> : null}
        <Input
          name="q"
          defaultValue={initialQuery}
          placeholder="Search library — names and aliases…"
          className="min-w-[200px] flex-1"
        />
        <Button type="submit" size="sm" variant="secondary">
          Search
        </Button>
        {initialQuery ? (
          <Button type="button" size="sm" variant="ghost" asChild>
            <Link href={libraryHref("", activeKind)}>Clear</Link>
          </Button>
        ) : null}
      </form>

      <div className="flex flex-wrap gap-2 rounded-md border border-border bg-panel p-2">
        <span className="w-full text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:w-auto sm:self-center">
          Browse by type
        </span>
        <p className="w-full text-[10px] leading-snug text-muted-foreground">
          Uses each file&apos;s stored type (from the evidence library).{" "}
          <span className="font-medium text-foreground/90">Suggested type</span> is set at upload;{" "}
          <span className="font-medium text-foreground/90">Confirmed</span> after you review. This is separate from
          investigation stacks (e.g. People, Location).
        </p>
        {(
          [
            [null, "All types"],
            ["document", "Document"],
            ["image", "Image"],
            ["video", "Video"],
            ["audio", "Audio"],
          ] as const
        ).map(([k, label]) => (
          <Button
            key={label}
            type="button"
            size="sm"
            variant={activeKind === k ? "default" : "outline"}
            className="h-8 text-xs"
            asChild
          >
            <Link href={libraryHref(initialQuery, k)}>{label}</Link>
          </Button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "Evidence Library"],
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
          <CardTitle className="text-base text-foreground">Evidence Library ({filtered.length})</CardTitle>
          <CardDescription className="leading-relaxed">
            Open a file for embedded viewing, zoom, crop, assign to a case, or compare. Use markers and filters to triage
            the list.
            {signedIn ? " Select rows to add to a case, add to evidence stack(s), or mark viewed." : null}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
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
              {signedIn ? (
                <li className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-xs text-foreground">
                  <label className="flex cursor-pointer items-center gap-2 font-medium">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      aria-label="Select all visible rows"
                    />
                    Select all in this list
                  </label>
                </li>
              ) : null}
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
                });
                const href = r.case_id ? `/cases/${r.case_id}/evidence/${r.id}` : `/evidence/${r.id}`;
                const staged = r.id === compareA || r.id === compareB;
                const id = r.id as string;
                return (
                  <li
                    key={r.id}
                    draggable
                    onDragStart={(ev) => {
                      ev.dataTransfer.setData(WORKSPACE_AI_DRAG_MIME, r.id);
                      ev.dataTransfer.effectAllowed = "copy";
                    }}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-panel px-3 py-2.5"
                  >
                    <div className="flex items-start gap-2.5 min-w-0">
                      {signedIn ? (
                        <input
                          type="checkbox"
                          className="mt-2 h-4 w-4 shrink-0 rounded border-input"
                          checked={selected.has(id)}
                          onChange={() => toggleSelect(id)}
                          aria-label={`Select ${primary}`}
                        />
                      ) : null}
                      <EvidenceListThumbnail
                        evidenceId={r.id}
                        mimeType={r.mime_type ?? null}
                        filenameHint={r.original_filename}
                        size="library"
                      />
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
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <EvidenceKindBadge row={r} />
                          <EvidenceStatusBullets kinds={bullets} />
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="h-8 border-sky-400 bg-sky-50 text-[10px] font-semibold text-sky-950 hover:bg-sky-100"
                        onClick={() =>
                          dispatchWorkspaceAiAttachEvidence({
                            evidenceId: r.id,
                            caseId: r.case_id ? String(r.case_id) : null,
                            label: primary,
                          })
                        }
                      >
                        Send to AI
                      </Button>
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
                        {r.case_id || r.case_membership_count > 0 ? "On a case" : "Add to case"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {signedIn && selected.size > 0 ? (
            <EvidenceBulkActionBar
              variant="library"
              casesForAssign={casesForAssign}
              selectedIds={[...selected]}
              onClearSelection={() => setSelected(new Set())}
            />
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
