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
import { resolveEvidenceMarker } from "@/lib/evidence-assignment-marker";
import { EvidenceAssignmentMarker } from "@/components/evidence-assignment-marker";
import { EvidenceMarkerLegend } from "@/components/evidence-marker-legend";

export type EvidenceRow = {
  id: string;
  case_id?: string | null;
  case_membership_count?: number;
  has_ai_analysis?: boolean;
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
};

type IndexFilter =
  | { key: "all"; label?: string; evidenceIds?: string[] }
  | { key: string; label: string; evidenceIds: string[] };

function pill(active: boolean) {
  return `text-left rounded-md border px-2 py-1.5 text-xs transition-colors ${
    active
      ? "border-sky-500/60 bg-sky-500/15 text-sky-100"
      : "border-zinc-700 bg-zinc-900/50 text-zinc-200 hover:border-zinc-500"
  }`;
}

export function CaseIndexWorkspace({
  caseId,
  snapshot,
  evidence,
  evidenceUploadSlot,
}: {
  caseId: string;
  snapshot: CaseIndexSnapshot;
  evidence: EvidenceRow[];
  /** Upload / import UI (e.g. `CaseEvidenceAddPanel`) rendered above the filtered list. */
  evidenceUploadSlot: React.ReactNode;
}) {
  const [filter, setFilter] = useState<IndexFilter>({ key: "all" });

  const filtered = useMemo(() => {
    if (filter.key === "all") return evidence;
    const allow = new Set(filter.evidenceIds ?? []);
    return evidence.filter((e) => allow.has(e.id));
  }, [evidence, filter]);

  const counts = evidence.length;

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
        <h4 className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{title}</h4>
        {empty && !children ? <p className="text-xs text-muted-foreground">{empty}</p> : children}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-zinc-800 bg-zinc-950/85 shadow-lg ring-1 ring-zinc-800/80" id="case-index">
        <CardHeader className="border-b border-zinc-800/90 pb-3">
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
                className="text-xs rounded-md border border-zinc-700 bg-zinc-900/60 px-2 py-1 text-sky-400 hover:bg-zinc-800"
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
                  <span className="block truncate font-medium text-zinc-100">{it.displayFilename}</span>
                  <span className="block truncate text-[11px] text-zinc-500">
                    {it.shortAlias ? (
                      <>
                        <span className="text-sky-400/90">{it.shortAlias}</span>
                        <span className="text-zinc-600"> · </span>
                      </>
                    ) : null}
                    <span className="text-zinc-500">{it.originalFilename}</span>
                  </span>
                </button>
              ))}
            </div>
          </Section>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-zinc-800/80">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="bg-zinc-800 border border-zinc-700"
              disabled={filter.key === "all"}
              onClick={() => setFilter({ key: "all" })}
            >
              Clear filter
            </Button>
            {filter.key !== "all" && "label" in filter ? (
              <span className="text-xs text-sky-400/90">
                Showing {filtered.length} of {counts} — {filter.label}
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">
                {counts} evidence file{counts === 1 ? "" : "s"}
              </span>
            )}
            <Link
              href={`/cases/${caseId}/timeline`}
              className="text-xs text-sky-400 hover:underline ml-auto"
            >
              Timelines
            </Link>
            <Link href={`/cases/${caseId}/entities`} className="text-xs text-sky-400 hover:underline">
              Entities
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card id="case-evidence">
        <CardHeader>
          <CardTitle>Evidence</CardTitle>
          <CardDescription>
            Add files or import from a link (provide source when possible). Use the case index above to filter this
            list.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {evidenceUploadSlot}
          <Separator />
          {filter.key !== "all" && "label" in filter ? (
            <p className="text-xs text-sky-400/90">
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
              {filtered.map((e) => {
                const primary = evidencePrimaryLabel({
                  display_filename: e.display_filename ?? null,
                  original_filename: e.original_filename,
                });
                const sal = e.short_alias?.trim();
                const markerKind = resolveEvidenceMarker({
                  caseId: e.case_id ?? null,
                  caseMembershipCount: e.case_membership_count ?? 0,
                  processingStatus: e.processing_status,
                  hasAiAnalysis: e.has_ai_analysis ?? false,
                });
                return (
                <li
                  key={e.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-zinc-800 bg-zinc-950/40 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <span className="mt-1.5">
                        <EvidenceAssignmentMarker kind={markerKind} />
                      </span>
                      <Link href={`/cases/${caseId}/evidence/${e.id}`} className="font-medium hover:underline truncate block min-w-0">
                        {primary}
                      </Link>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                      {sal ? (
                        <span className="inline-flex items-center gap-1 rounded border border-zinc-700/90 bg-zinc-900/80 px-1.5 py-0.5 text-[11px] font-mono text-sky-300/95">
                          {sal}
                          <CopyInlineButton text={sal} label="Copy short alias" />
                        </span>
                      ) : null}
                      <span className="text-[11px] text-zinc-500 truncate max-w-full" title={e.original_filename}>
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
                  <ProcessingBadge status={e.processing_status} />
                </li>
              );
              })}
            </ul>
          )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
