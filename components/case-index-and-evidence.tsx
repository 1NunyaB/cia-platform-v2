"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { CaseIndexSnapshot } from "@/services/case-index-service";
import type { EvidenceProcessingStatus } from "@/types";
import { ProcessingBadge } from "@/components/processing-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { EVIDENCE_SOURCE_TYPE_LABELS } from "@/lib/evidence-source";
import type { EvidenceSourceType } from "@/lib/evidence-source";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";
import { CopyInlineButton } from "@/components/copy-inline-button";
import { resolveEvidenceStatusBullets } from "@/lib/evidence-status-bullets";
import { EvidenceStatusBullets } from "@/components/evidence-status-bullets";
import { EvidenceMarkerLegend } from "@/components/evidence-marker-legend";
import { EvidenceListThumbnail } from "@/components/evidence-list-thumbnail";
import {
  WORKSPACE_AI_DRAG_MIME,
  dispatchWorkspaceAiAttachEvidence,
} from "@/lib/workspace-evidence-ai-bridge";
import { EvidenceBulkActionBar } from "@/components/evidence-bulk-action-bar";
import { EvidenceKindBadge } from "@/components/evidence-kind-badge";
import { cisCasePage } from "@/lib/cis-case-page-shell";
import { cn } from "@/lib/utils";
import { evidenceRowNeedsReviewUnopened } from "@/lib/evidence-row-needs";

export type EvidenceRow = {
  id: string;
  case_id?: string | null;
  case_membership_count?: number;
  has_ai_analysis?: boolean;
  viewed?: boolean;
  has_content_duplicate_peer?: boolean;
  extraction_status?: string | null;
  original_filename: string;
  display_filename?: string | null;
  short_alias?: string | null;
  file_sequence_number?: number | null;
  mime_type: string | null;
  processing_status: EvidenceProcessingStatus;
  created_at?: string;
  source_type?: string | null;
  source_platform?: string | null;
  source_program?: string | null;
  source_url?: string | null;
  suggested_evidence_kind?: string | null;
  confirmed_evidence_kind?: string | null;
};

type IndexFilter =
  | { key: "all"; label?: string; evidenceIds?: string[] }
  | { key: string; label: string; evidenceIds: string[] };

function pill(active: boolean) {
  return cn(cisCasePage.indexPillBase, active ? cisCasePage.indexPillActive : cisCasePage.indexPillInactive);
}

export function CaseIndexWorkspace({
  caseId,
  snapshot,
  evidence,
  evidenceUploadSlot,
  allowBulkActions = false,
}: {
  caseId: string;
  snapshot: CaseIndexSnapshot;
  evidence: EvidenceRow[];
  /** Upload / import UI (e.g. `CaseEvidenceAddPanel`) rendered above the filtered list. */
  evidenceUploadSlot: React.ReactNode;
  /** Signed-in users get bulk select + actions on the case evidence list. */
  allowBulkActions?: boolean;
}) {
  const [filter, setFilter] = useState<IndexFilter>({ key: "all" });
  const [selected, setSelected] = useState<Set<string>>(() => new Set());

  const filtered = useMemo(() => {
    if (filter.key === "all") return evidence;
    const allow = new Set(filter.evidenceIds ?? []);
    return evidence.filter((e) => allow.has(e.id));
  }, [evidence, filter]);

  const counts = evidence.length;

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((e) => selected.has(e.id));

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
        for (const e of filtered) next.delete(e.id);
      } else {
        for (const e of filtered) next.add(e.id);
      }
      return next;
    });
  }

  function Section({
    title,
    children,
    empty,
  }: {
    title: string;
    children: React.ReactNode;
    empty?: string;
  }) {
    return (
      <div className="space-y-2">
        <h4 className={cisCasePage.indexSectionTitle}>{title}</h4>
        {empty && !children ? <p className="text-xs text-slate-500">{empty}</p> : children}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className={cn(cisCasePage.panel)} id="case-index">
        <CardHeader className={cn("pb-3", cisCasePage.panelHeaderBorder)}>
          <CardTitle className={cn(cisCasePage.cardTitle, "text-lg")}>Case index</CardTitle>
          <CardDescription className={cn(cisCasePage.cardDescription, "text-sm")}>
            Live navigation by clusters, aliases, roles, places, time, events, and sources. Click an entry to filter
            evidence below. Updates when evidence and analysis change.
          </CardDescription>
        </CardHeader>
        <CardContent className="max-h-[min(70vh,720px)] space-y-6 overflow-y-auto pr-1 pt-4">
          <Section title="Cases">
            <div className="flex flex-wrap gap-2">
              <Link
                href="/cases"
                className="rounded-md border border-[#1e2d42] bg-[#0f1623] px-2 py-1 text-xs font-medium text-sky-400 hover:border-sky-500/40 hover:bg-[#1a2335]"
              >
                All cases
              </Link>
              <span className="py-1 text-xs text-slate-500">This workspace</span>
            </div>
          </Section>

          <Section title="Clusters" empty={snapshot.clusters.length ? undefined : "No clusters yet."}>
            <div className="flex flex-wrap gap-1.5">
              {snapshot.clusters.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={pill(filter.key === `cluster:${c.id}`)}
                  onClick={() =>
                    setFilter({
                      key: `cluster:${c.id}`,
                      label: c.title,
                      evidenceIds: c.evidenceIds,
                    })
                  }
                >
                  {c.title}{" "}
                  <span className="text-slate-500">({c.evidenceIds.length})</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Aliases" empty={snapshot.aliases.length ? undefined : "No aliases yet."}>
            <div className="flex flex-wrap gap-1.5">
              {snapshot.aliases.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  className={pill(filter.key === `alias:${a.id}`)}
                  onClick={() =>
                    setFilter({
                      key: `alias:${a.id}`,
                      label: a.aliasDisplay,
                      evidenceIds: a.evidenceIds,
                    })
                  }
                  title={a.entityLabel}
                >
                  {a.aliasDisplay}{" "}
                  <span className="text-slate-500">· {a.entityLabel}</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Accusers" empty={snapshot.accusers.length ? undefined : "No accuser-tagged entities."}>
            <div className="flex flex-wrap gap-1.5">
              {snapshot.accusers.map((a) => (
                <button
                  key={a.entityId}
                  type="button"
                  className={pill(filter.key === `accuser:${a.entityId}`)}
                  onClick={() =>
                    setFilter({
                      key: `accuser:${a.entityId}`,
                      label: a.label,
                      evidenceIds: a.evidenceIds,
                    })
                  }
                >
                  {a.label} <span className="text-slate-500">({a.evidenceIds.length})</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Victims" empty={snapshot.victims.length ? undefined : "No victim-tagged entities."}>
            <div className="flex flex-wrap gap-1.5">
              {snapshot.victims.map((a) => (
                <button
                  key={a.entityId}
                  type="button"
                  className={pill(filter.key === `victim:${a.entityId}`)}
                  onClick={() =>
                    setFilter({
                      key: `victim:${a.entityId}`,
                      label: a.label,
                      evidenceIds: a.evidenceIds,
                    })
                  }
                >
                  {a.label} <span className="text-slate-500">({a.evidenceIds.length})</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Locations" empty={snapshot.locations.length ? undefined : "No place-like entities yet."}>
            <div className="flex flex-wrap gap-1.5">
              {snapshot.locations.map((a) => (
                <button
                  key={a.entityId}
                  type="button"
                  className={pill(filter.key === `loc:${a.entityId}`)}
                  onClick={() =>
                    setFilter({
                      key: `loc:${a.entityId}`,
                      label: a.label,
                      evidenceIds: a.evidenceIds,
                    })
                  }
                >
                  {a.label} <span className="text-slate-500">({a.evidenceIds.length})</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Years" empty={snapshot.years.length ? undefined : "No dated material yet."}>
            <div className="flex flex-wrap gap-1.5">
              {snapshot.years.map((y) => (
                <button
                  key={y.key}
                  type="button"
                  className={pill(filter.key === `year:${y.key}`)}
                  onClick={() =>
                    setFilter({ key: `year:${y.key}`, label: y.label, evidenceIds: y.evidenceIds })
                  }
                >
                  {y.label} <span className="text-slate-500">({y.evidenceIds.length})</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Months" empty={snapshot.months.length ? undefined : "No month buckets yet."}>
            <div className="flex flex-wrap gap-1.5">
              {snapshot.months.map((y) => (
                <button
                  key={y.key}
                  type="button"
                  className={pill(filter.key === `month:${y.key}`)}
                  onClick={() =>
                    setFilter({ key: `month:${y.key}`, label: y.label, evidenceIds: y.evidenceIds })
                  }
                >
                  {y.label} <span className="text-slate-500">({y.evidenceIds.length})</span>
                </button>
              ))}
            </div>
          </Section>

          <Section title="Events" empty={snapshot.events.length ? undefined : "No timeline events yet."}>
            <div className="flex flex-col gap-1.5">
              {snapshot.events.map((ev) => (
                <button
                  key={ev.id}
                  type="button"
                  className={`${pill(filter.key === `event:${ev.id}`)} line-clamp-2`}
                  onClick={() =>
                    setFilter({
                      key: `event:${ev.id}`,
                      label: ev.title,
                      evidenceIds: ev.evidenceIds,
                    })
                  }
                >
                  {ev.title}{" "}
                  <span className="text-slate-500">
                    {ev.occurredAt ? `· ${ev.occurredAt.slice(0, 10)}` : ""} ({ev.evidenceIds.length})
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <Section
            title="Sources & programs"
            empty={snapshot.sources.length ? undefined : "Source metadata will appear after uploads include source fields."}
          >
            <div className="flex flex-col gap-1.5">
              {snapshot.sources.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={pill(filter.key === `src:${s.key}`)}
                  onClick={() =>
                    setFilter({
                      key: `src:${s.key}`,
                      label: s.label,
                      evidenceIds: s.evidenceIds,
                    })
                  }
                >
                  <span className="block truncate">
                    {EVIDENCE_SOURCE_TYPE_LABELS[s.sourceType as EvidenceSourceType] ?? s.sourceType}
                    {s.platform ? ` · ${s.platform}` : ""}
                    {s.program ? ` · ${s.program}` : ""}
                  </span>
                  <span className="text-slate-500">({s.evidenceIds.length})</span>
                </button>
              ))}
            </div>
          </Section>

          <Section
            title="Evidence names & aliases"
            empty={snapshot.evidenceItems.length ? undefined : "No evidence files indexed yet."}
          >
            <div className="flex flex-col gap-1 max-h-[min(28vh,240px)] overflow-y-auto pr-0.5">
              {snapshot.evidenceItems.map((it) => (
                <button
                  key={it.evidenceId}
                  type="button"
                  className={`${pill(filter.key === `evidence:${it.evidenceId}`)} text-left w-full`}
                  onClick={() =>
                    setFilter({
                      key: `evidence:${it.evidenceId}`,
                      label: it.shortAlias || it.displayFilename,
                      evidenceIds: [it.evidenceId],
                    })
                  }
                  title={it.originalFilename}
                >
                  <span className="block truncate font-medium text-slate-100">{it.displayFilename}</span>
                  <span className="block truncate text-[11px] text-slate-500">
                    {it.shortAlias ? (
                      <>
                        <span className="font-medium text-sky-400">{it.shortAlias}</span>
                        <span className="text-slate-500"> · </span>
                      </>
                    ) : null}
                    <span className="text-slate-500">{it.originalFilename}</span>
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <div className="flex flex-wrap items-center gap-2 border-t border-[#1e2d42] pt-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={filter.key === "all"}
              className={cisCasePage.secondaryBtn}
              onClick={() => setFilter({ key: "all" })}
            >
              Clear filter
            </Button>
            {filter.key !== "all" && "label" in filter ? (
              <span className="text-xs font-medium text-sky-300">
                Showing {filtered.length} of {counts} — {filter.label}
              </span>
            ) : (
              <span className="text-xs text-slate-500">
                {counts} evidence file{counts === 1 ? "" : "s"}
              </span>
            )}
            <Link href={`/cases/${caseId}/timeline`} className={cn("ml-auto text-xs", cisCasePage.linkAccent)}>
              Timelines
            </Link>
            <Link href={`/cases/${caseId}/entities`} className={cn("text-xs", cisCasePage.linkAccent)}>
              Entities
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card id="case-evidence" className={cn(cisCasePage.panel)}>
        <CardHeader className={cn("pb-3", cisCasePage.panelHeaderBorder)}>
          <CardTitle className={cisCasePage.cardTitle}>Current case evidence</CardTitle>
          <CardDescription className={cisCasePage.cardDescription}>
            Use <span className="font-medium text-slate-200">Add evidence</span> for uploads and URL imports (source
            details on the next screens). Filter this list with the case index above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {evidenceUploadSlot}
          <Separator className="border-[#1e2d42]/90" />
          {filter.key !== "all" && "label" in filter ? (
            <p className="text-xs font-medium text-sky-300">
              Index filter: {filter.label} — showing {filtered.length} of {counts}.
            </p>
          ) : null}
          <div>
            <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
              <h3 className="text-sm font-medium text-slate-200">Files</h3>
              <EvidenceMarkerLegend className="max-w-[220px]" />
            </div>
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-500">No evidence matches this index selection.</p>
          ) : (
            <ul className="space-y-2">
              {allowBulkActions ? (
                <li className={cisCasePage.bulkSelectRow}>
                  <label className="flex cursor-pointer items-center gap-2 font-medium text-slate-300">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-[#334155] bg-[#0f1623] text-sky-500"
                      checked={allFilteredSelected}
                      onChange={toggleSelectAllFiltered}
                      aria-label="Select all visible rows"
                    />
                    Select all in this list
                  </label>
                </li>
              ) : null}
              {filtered.map((e) => {
                const primary = evidencePrimaryLabel({
                  display_filename: e.display_filename ?? null,
                  original_filename: e.original_filename,
                });
                const sal = e.short_alias?.trim();
                const bullets = resolveEvidenceStatusBullets({
                  caseId: e.case_id ?? null,
                  caseMembershipCount: e.case_membership_count ?? 0,
                  processingStatus: e.processing_status,
                  hasAiAnalysis: e.has_ai_analysis ?? false,
                  viewed: e.viewed ?? false,
                  hasContentDuplicatePeer: e.has_content_duplicate_peer ?? false,
                });
                const needsReviewUnopened = evidenceRowNeedsReviewUnopened({
                  processingStatus: e.processing_status,
                  hasAiAnalysis: e.has_ai_analysis ?? false,
                  viewed: e.viewed ?? false,
                });
                return (
                <li
                  key={e.id}
                  draggable
                  onDragStart={(ev) => {
                    ev.dataTransfer.setData(WORKSPACE_AI_DRAG_MIME, e.id);
                    ev.dataTransfer.effectAllowed = "copy";
                  }}
                  className={cn(
                    cisCasePage.evidenceRow,
                    needsReviewUnopened &&
                      "border-l-4 border-l-amber-400 bg-amber-500/[0.06] shadow-[inset_0_0_0_1px_rgba(251,191,36,0.12)]",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      {allowBulkActions ? (
                        <input
                          type="checkbox"
                          className="mt-2 h-4 w-4 shrink-0 rounded border-[#334155] bg-[#0f1623] text-sky-500"
                          checked={selected.has(e.id)}
                          onChange={() => toggleSelect(e.id)}
                          aria-label={`Select ${primary}`}
                        />
                      ) : null}
                      <EvidenceListThumbnail
                        evidenceId={e.id}
                        mimeType={e.mime_type}
                        filenameHint={e.original_filename}
                      />
                      <span className="mt-1.5">
                        <EvidenceStatusBullets kinds={bullets} emphasizeNeedsReviewUnopened={needsReviewUnopened} />
                      </span>
                      <Link
                        href={`/cases/${caseId}/evidence/${e.id}`}
                        className="block min-w-0 truncate pt-0.5 font-medium text-sky-300 hover:text-sky-200 hover:underline"
                      >
                        {primary}
                      </Link>
                    </div>
                    <div className="mt-1">
                      <EvidenceKindBadge row={e} compact />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      {sal ? (
                        <span className="inline-flex items-center gap-1 rounded border border-[#334155] bg-[#0f1623] px-1.5 py-0.5 font-mono text-[11px] text-slate-200">
                          {sal}
                          <CopyInlineButton text={sal} label="Copy short alias (in-app ID)" />
                        </span>
                      ) : null}
                      <span className="text-[11px] text-slate-500 truncate max-w-full" title={e.original_filename}>
                        Original: {e.original_filename}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      {e.mime_type ?? "unknown type"}
                      {e.source_type && e.source_type !== "unknown" ? (
                        <>
                          {" "}
                          · {EVIDENCE_SOURCE_TYPE_LABELS[e.source_type as EvidenceSourceType] ?? e.source_type}
                          {e.source_platform ? ` · ${e.source_platform}` : ""}
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className={cisCasePage.sendToAiBtn}
                      onClick={() =>
                        dispatchWorkspaceAiAttachEvidence({
                          evidenceId: e.id,
                          caseId,
                          label: primary,
                        })
                      }
                    >
                      Send to AI
                    </Button>
                    <ProcessingBadge status={e.processing_status} />
                  </div>
                </li>
              );
              })}
            </ul>
          )}
          {allowBulkActions && selected.size > 0 ? (
            <EvidenceBulkActionBar
              variant="case"
              caseId={caseId}
              selectedIds={[...selected]}
              onClearSelection={() => setSelected(new Set())}
              appearance="cisCase"
            />
          ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
