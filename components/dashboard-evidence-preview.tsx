"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { EvidenceProcessingStatus } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EvidenceStatusBullets } from "@/components/evidence-status-bullets";
import { resolveEvidenceStatusBullets } from "@/lib/evidence-status-bullets";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";
import { EVIDENCE_SOURCE_TYPE_LABELS, type EvidenceSourceType } from "@/lib/evidence-source";
import { dispatchWorkspaceAiAttachEvidence } from "@/lib/workspace-evidence-ai-bridge";
import { EvidenceBulkActionBar } from "@/components/evidence-bulk-action-bar";

export type DashboardEvidencePreviewRow = {
  id: string;
  original_filename: string;
  display_filename?: string | null;
  short_alias?: string | null;
  created_at: string;
  case_id: string | null;
  source_type?: string | null;
  source_platform?: string | null;
  source_program?: string | null;
  processing_status: EvidenceProcessingStatus;
  extraction_status?: string | null;
  case_membership_count: number;
  has_ai_analysis: boolean;
  viewed: boolean;
  has_content_duplicate_peer: boolean;
};

export function DashboardEvidencePreview({
  panelClassName,
  loading = false,
  loadError = null,
  rows,
  casesForAssign,
  selectedIds,
  onSelectedIdsChange,
  onAddSelectionToTimeline,
  onAddSelectionToMap,
  activeEventId,
  activeMarkerId,
}: {
  panelClassName?: string;
  loading?: boolean;
  loadError?: string | null;
  rows: DashboardEvidencePreviewRow[];
  casesForAssign: { id: string; title: string }[];
  selectedIds?: string[];
  onSelectedIdsChange?: (ids: string[]) => void;
  onAddSelectionToTimeline?: (ids: string[]) => void;
  onAddSelectionToMap?: (ids: string[]) => void;
  activeEventId?: string | null;
  activeMarkerId?: string | null;
}) {
  const [internalSelected, setInternalSelected] = useState<string[]>([]);
  const [selectionNotice, setSelectionNotice] = useState<string | null>(null);
  const selected = selectedIds ?? internalSelected;
  const updateSelected = (updater: (prev: string[]) => string[]) => {
    const next = updater(selected);
    if (onSelectedIdsChange) onSelectedIdsChange(next);
    else setInternalSelected(next);
  };
  function toggleSelected(id: string, checked: boolean) {
    updateSelected((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        if (prev.length >= 2) {
          setSelectionNotice("Comparison supports up to 2 selected files on the dashboard.");
          return prev;
        }
        setSelectionNotice(null);
        return [...prev, id];
      }
      setSelectionNotice(null);
      return prev.filter((x) => x !== id);
    });
  }

  const selectedRows = useMemo(() => rows.filter((r) => selected.includes(r.id)), [rows, selected]);
  const selectedCount = selected.length;
  const clearSelection = () => {
    if (onSelectedIdsChange) onSelectedIdsChange([]);
    else setInternalSelected([]);
  };
  const firstSelected = selectedRows[0] ?? null;
  const openHref = firstSelected
    ? (firstSelected.case_id
        ? `/cases/${firstSelected.case_id}/evidence/${firstSelected.id}`
        : `/evidence/${firstSelected.id}`)
    : null;

  const compareHref =
    selected.length === 2
      ? `/evidence/compare?a=${encodeURIComponent(selected[0]!)}&b=${encodeURIComponent(selected[1]!)}`
      : null;

  return (
    <Card
      className={
        panelClassName ??
        "min-h-0 border-slate-500/70 bg-gradient-to-br from-slate-800 to-slate-900 text-slate-100 shadow-sm"
      }
    >
      <CardHeader className="space-y-0 border-b border-sky-400/10 px-2.5 py-2">
        <CardTitle className="text-sm font-semibold text-slate-100">Evidence</CardTitle>
      </CardHeader>
      <CardContent className="flex min-h-[min(58vh,720px)] flex-col gap-2 p-2.5 pt-2">
        {loadError ? (
          <p className="rounded border border-red-400/50 bg-red-950/40 px-2 py-1.5 text-xs text-red-100">{loadError}</p>
        ) : null}
        {loading ? (
          <p className="rounded border border-slate-600/50 bg-slate-950/40 px-2 py-1.5 text-[11px] text-slate-400">
            Loading evidence…
          </p>
        ) : null}
        {selectedCount > 0 ? (
          <div className="rounded-md border border-sky-400/35 bg-sky-950/40 px-2 py-2 text-slate-50 shadow-[0_0_24px_-12px_rgba(56,189,248,0.45)]">
            <div className="flex flex-wrap items-center gap-1.5">
              <p className="text-xs font-semibold text-sky-100">
                {selectedCount} selected
                {selectedCount === 1 ? " file" : " files"}
              </p>
              <Button type="button" size="sm" variant="outline" className="h-8 border-slate-500/60 bg-slate-900/50 text-slate-100" onClick={clearSelection}>
                Clear
              </Button>
              {openHref && selectedCount === 1 ? (
                <Button type="button" size="sm" variant="secondary" className="h-8" asChild>
                  <Link href={openHref}>Open</Link>
                </Button>
              ) : null}
              <Button type="button" size="sm" variant="secondary" className="h-8" asChild>
                <Link href="/evidence">Add to case</Link>
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 border-amber-400/60 bg-amber-500/15 text-amber-50 hover:bg-amber-500/25"
                onClick={() => onAddSelectionToTimeline?.(selected)}
              >
                Add to timeline
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 border-emerald-400/50 bg-emerald-500/15 text-emerald-50 hover:bg-emerald-500/25"
                onClick={() => onAddSelectionToMap?.(selected)}
              >
                Add to map location
              </Button>
              <Button type="button" size="sm" variant="secondary" className="h-8" asChild>
                <Link href="/evidence">Stacks</Link>
              </Button>
              {compareHref ? (
                <Button type="button" size="sm" className="h-8 bg-sky-500 text-slate-950 hover:bg-sky-400" asChild>
                  <Link href={compareHref}>Compare</Link>
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 border-sky-400/50 bg-sky-500/20 font-semibold text-sky-50 hover:bg-sky-500/30"
                onClick={() =>
                  dispatchWorkspaceAiAttachEvidence({
                    evidenceIds: selected,
                    caseId: firstSelected?.case_id ?? null,
                  })
                }
              >
                Send to AI
              </Button>
            </div>
            <EvidenceBulkActionBar
              variant="library"
              casesForAssign={casesForAssign}
              selectedIds={selected}
              onClearSelection={clearSelection}
              inline
            />
          </div>
        ) : (
          <p className="rounded border border-slate-600/50 bg-slate-950/35 px-2 py-1 text-[11px] text-slate-400">
            Select up to two rows for compare and bulk actions.
          </p>
        )}
        {selectionNotice ? (
          <p className="rounded border border-amber-400/70 bg-amber-300/10 px-2 py-1 text-xs font-medium text-amber-100">
            {selectionNotice}
          </p>
        ) : null}
        {!loading && rows.length === 0 ? (
          <div className="rounded-md border border-slate-600/50 bg-slate-950/40 px-3 py-4 text-sm text-slate-300">
            No evidence in this view.
          </div>
        ) : null}
        {!loading && rows.length > 0 ? (
          <ul className="min-h-0 flex-1 divide-y divide-slate-600/50 overflow-y-auto rounded-md border border-slate-500/35 bg-slate-950/30 shadow-[inset_0_1px_0_rgba(125,211,252,0.04)]">
            {rows.map((r) => {
              const href = r.case_id
                ? `/cases/${r.case_id}/evidence/${r.id}`
                : `/evidence/${r.id}`;
              const primary = evidencePrimaryLabel({
                display_filename: r.display_filename ?? null,
                original_filename: r.original_filename,
              });
              const bullets = resolveEvidenceStatusBullets({
                caseId: r.case_id,
                caseMembershipCount: r.case_membership_count,
                processingStatus: r.processing_status,
                hasAiAnalysis: r.has_ai_analysis,
                viewed: r.viewed,
                hasContentDuplicatePeer: r.has_content_duplicate_peer,
              });
              const sourceLabel =
                (r.source_program && String(r.source_program).trim()) ||
                (r.source_platform && String(r.source_platform).trim()) ||
                EVIDENCE_SOURCE_TYPE_LABELS[(r.source_type as EvidenceSourceType) ?? "unknown"] ||
                "";
              const checked = selected.includes(r.id);
              return (
                <li
                  key={r.id}
                  className={`px-2.5 py-2 hover:bg-slate-800/40 ${
                    checked || (activeEventId || activeMarkerId) && selected.includes(r.id)
                      ? "bg-sky-500/10 ring-1 ring-sky-400/35"
                      : ""
                  }`}
                >
                  <div className="flex items-start gap-2 md:grid md:grid-cols-[auto_auto_1fr] md:items-center md:gap-x-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-input md:mt-0"
                      checked={checked}
                      onChange={(e) => toggleSelected(r.id, e.target.checked)}
                      aria-label={`Select ${primary} for dashboard actions`}
                    />
                    <span className="mt-1 shrink-0 md:mt-0">
                      <EvidenceStatusBullets kinds={bullets} />
                    </span>
                    <Link href={href} className="block min-w-0">
                      <span className="block truncate text-sm font-medium text-slate-100">{primary}</span>
                      <span className="mt-0.5 flex flex-wrap items-baseline gap-x-2 gap-y-0 text-[10px] text-slate-400">
                        <span className="truncate">{sourceLabel || "—"}</span>
                        <span className="shrink-0 text-slate-500">
                          {r.case_id || r.case_membership_count > 0 ? "Case" : "Library"} ·{" "}
                          {new Date(r.created_at).toLocaleString()}
                        </span>
                      </span>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
