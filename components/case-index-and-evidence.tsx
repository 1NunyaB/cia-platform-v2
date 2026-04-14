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
  return `text-left rounded-md border px-2 py-1.5 text-xs transition-colors ${
    active
      ? "border-sky-500 bg-sky-100 text-foreground font-medium"
      : "border-border bg-white text-foreground hover:bg-panel hover:border-ring"
  }`;
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
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
        {empty && !children ? <p className="text-xs text-muted-foreground">{empty}</p> : children}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border bg-white shadow-md" id="case-index">
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="text-lg tracking-tight text-foreground">Case index</CardTitle>
          <CardDescription className="text-muted-foreground text-sm">
            Live navigation by clusters, aliases, roles, places, time, events, and sources. Click an entry to filter
            evidence below. Updates when evidence and analysis change.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4 space-y-6 max-h-[min(70vh,720px)] overflow-y-auto pr-1">
          <Section title="Cases">
            <div className="flex flex-wrap gap-2">
              <Link
                href="/cases"
                className="text-xs rounded-md border border-border bg-document px-2 py-1 text-blue-900 font-medium hover:bg-sky-100"
              >
                All cases
              </Link>
              <span className="text-xs text-muted-foreground py-1">This workspace</span>
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
                  <span className="text-muted-foreground">({c.evidenceIds.length})</span>
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
                  <span className="text-muted-foreground">· {a.entityLabel}</span>
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
                  {a.label} <span className="text-muted-foreground">({a.evidenceIds.length})</span>
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
                  {a.label} <span className="text-muted-foreground">({a.evidenceIds.length})</span>
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
                  {a.label} <span className="text-muted-foreground">({a.evidenceIds.length})</span>
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
                  {y.label} <span className="text-muted-foreground">({y.evidenceIds.length})</span>
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
                  {y.label} <span className="text-muted-foreground">({y.evidenceIds.length})</span>
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
                  <span className="text-muted-foreground">
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
                  <span className="text-muted-foreground">({s.evidenceIds.length})</span>
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
                  <span className="block truncate font-medium text-foreground">{it.displayFilename}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {it.shortAlias ? (
                      <>
                        <span className="text-blue-800 font-medium">{it.shortAlias}</span>
                        <span className="text-muted-foreground"> · </span>
                      </>
                    ) : null}
                    <span className="text-muted-foreground">{it.originalFilename}</span>
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-border">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={filter.key === "all"}
              onClick={() => setFilter({ key: "all" })}
            >
              Clear filter
            </Button>
            {filter.key !== "all" && "label" in filter ? (
              <span className="text-xs text-blue-900 font-medium">
                Showing {filtered.length} of {counts} — {filter.label}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {counts} evidence file{counts === 1 ? "" : "s"}
              </span>
            )}
            <Link
              href={`/cases/${caseId}/timeline`}
              className="text-xs text-blue-800 font-medium hover:underline ml-auto"
            >
              Timelines
            </Link>
            <Link href={`/cases/${caseId}/entities`} className="text-xs text-blue-800 font-medium hover:underline">
              Entities
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card id="case-evidence" className="border-border bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Current case evidence</CardTitle>
          <CardDescription>
            Use <span className="font-medium text-foreground">Add evidence</span> for uploads and URL imports (source
            details on the next screens). Filter this list with the case index above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {evidenceUploadSlot}
          <Separator />
          {filter.key !== "all" && "label" in filter ? (
            <p className="text-xs text-blue-900 font-medium">
              Index filter: {filter.label} — showing {filtered.length} of {counts}.
            </p>
          ) : null}
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3 mb-2">
              <h3 className="text-sm font-medium text-foreground">Files</h3>
              <EvidenceMarkerLegend className="max-w-[220px]" />
            </div>
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground">No evidence matches this index selection.</p>
          ) : (
            <ul className="space-y-2">
              {allowBulkActions ? (
                <li className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border bg-muted/30 px-2.5 py-2 text-xs text-foreground">
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
                return (
                <li
                  key={e.id}
                  draggable
                  onDragStart={(ev) => {
                    ev.dataTransfer.setData(WORKSPACE_AI_DRAG_MIME, e.id);
                    ev.dataTransfer.effectAllowed = "copy";
                  }}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-panel p-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      {allowBulkActions ? (
                        <input
                          type="checkbox"
                          className="mt-2 h-4 w-4 shrink-0 rounded border-input"
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
                        <EvidenceStatusBullets kinds={bullets} />
                      </span>
                      <Link href={`/cases/${caseId}/evidence/${e.id}`} className="font-medium hover:underline truncate block min-w-0 pt-0.5">
                        {primary}
                      </Link>
                    </div>
                    <div className="mt-1">
                      <EvidenceKindBadge row={e} compact />
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      {sal ? (
                        <span className="inline-flex items-center gap-1 rounded border border-document-border bg-document px-1.5 py-0.5 text-[11px] font-mono text-foreground">
                          {sal}
                          <CopyInlineButton text={sal} label="Copy short alias (in-app ID)" />
                        </span>
                      ) : null}
                      <span className="text-[11px] text-muted-foreground truncate max-w-full" title={e.original_filename}>
                        Original: {e.original_filename}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
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
                      className="h-7 border-sky-400 bg-sky-50 px-2 text-[10px] font-semibold text-sky-950 hover:bg-sky-100"
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
            />
          ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
