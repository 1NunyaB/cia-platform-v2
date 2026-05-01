import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseIncidentEntries } from "@/lib/case-directory";
import { getCaseById } from "@/services/case-service";
import { normalizeTimelineKind } from "@/lib/timeline-kind-schema";
import { detectTimelineConflicts } from "@/lib/timeline-conflicts";
import { listTheoryPlacementsForUser } from "@/services/timeline-theory-service";
import { logActivity } from "@/services/activity-service";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { TimelineKind } from "@/types/analysis";
import {
  CaseTimelineWorkspace,
  type WorkspaceTimelineEvent,
  type CaseFileRef,
} from "@/components/case-timeline-workspace";

const KIND_ORDER: TimelineKind[] = [
  "witness",
  "subject_actor",
  "official",
  "evidence",
  "reconstructed",
  "custom",
];

type TimelineRow = WorkspaceTimelineEvent;
type TimelineEvidenceRow = {
  timeline_event_id: string;
  evidence_file_id: string;
  evidence_files: { id: string; original_filename: string } | null;
};
type TimelineBaseRow = Omit<TimelineRow, "timeline_event_evidence">;
type TimelineIncidentOption = {
  id: string;
  title: string;
  description: string;
  date: string | null;
  year: number | null;
  people: { name: string; role: string }[];
};

function parseKind(raw: string | undefined): TimelineKind {
  if (!raw || raw === "all") return "evidence";
  return normalizeTimelineKind(raw);
}

function sortByOccurred(a: TimelineRow, b: TimelineRow): number {
  const ta = a.occurred_at ? new Date(a.occurred_at).getTime() : Number.NEGATIVE_INFINITY;
  const tb = b.occurred_at ? new Date(b.occurred_at).getTime() : Number.NEGATIVE_INFINITY;
  if (ta !== tb) return ta - tb;
  return a.title.localeCompare(b.title);
}

export default async function CaseTimelinePage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{
    q?: string;
    kind?: string;
    compare?: string;
    year?: string;
    month?: string;
    week?: string;
    customLane?: string;
  }>;
}) {
  const { caseId } = await params;
  const { q, kind: kindRaw, compare: compareRaw, year, month, week, customLane } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && (year?.trim() || month?.trim() || week?.trim())) {
    try {
      await logActivity(supabase, {
        caseId,
        actorId: user.id,
        actorLabel: "Analyst",
        action: "timeline.drilldown",
        entityType: "timeline",
        entityId: caseId,
        payload: {
          year: year?.trim() || null,
          month: month?.trim() || null,
          week: week?.trim() || null,
          kind: kindRaw ?? null,
        },
      });
    } catch {
      /* non-blocking */
    }
  }

  const c = await getCaseById(supabase, caseId);
  if (!c) notFound();

  const primaryKind: TimelineKind | "all" = kindRaw === "all" ? "all" : parseKind(kindRaw);
  const compareKind = compareRaw ? normalizeTimelineKind(compareRaw) : null;
  const effectiveCompare =
    compareKind && compareKind !== (primaryKind === "all" ? null : primaryKind) ? compareKind : null;

  const initialSelectedLanes: TimelineKind[] =
    primaryKind === "all"
      ? [...KIND_ORDER]
      : effectiveCompare
        ? [primaryKind as TimelineKind, effectiveCompare]
        : [primaryKind as TimelineKind];

  let timelineEventsWarning: string | null = null;
  let eventRows: TimelineBaseRow[] = [];

  const { data: eventsWithOptionalCols, error: eventsWithOptionalColsError } = await supabase
    .from("timeline_events")
    .select(
      `
      id,
      title,
      summary,
      occurred_at,
      evidence_file_id,
      timeline_tier,
      timeline_kind,
      custom_lane_label,
      source_label,
      event_classification,
      event_reasoning,
      event_limitations,
      authenticity_label
    `,
    )
    .eq("case_id", caseId)
    .order("occurred_at", { ascending: true, nullsFirst: false });

  if (eventsWithOptionalColsError) {
    const { data: eventsMinimal, error: eventsMinimalError } = await supabase
      .from("timeline_events")
      .select(
        `
        id,
        title,
        summary,
        occurred_at,
        evidence_file_id,
        timeline_kind,
        custom_lane_label,
        source_label,
        event_classification,
        event_reasoning,
        event_limitations,
        authenticity_label
      `,
      )
      .eq("case_id", caseId)
      .order("occurred_at", { ascending: true, nullsFirst: false });

    if (eventsMinimalError) {
      timelineEventsWarning = "Some timeline data could not be loaded. Showing available events only.";
      eventRows = [];
    } else {
      timelineEventsWarning = "Some timeline fields are unavailable. Showing compatible event data.";
      eventRows = (eventsMinimal ?? []).map((row) => ({
        ...(row as unknown as Omit<TimelineBaseRow, "timeline_tier">),
        timeline_tier: null,
      })) as TimelineBaseRow[];
    }
  } else {
    eventRows = (eventsWithOptionalCols ?? []) as unknown as TimelineBaseRow[];
  }

  const eventIds = eventRows.map((row) => row.id);
  let timelineEvidenceWarning: string | null = null;
  let evidenceByEvent = new Map<string, TimelineRow["timeline_event_evidence"]>();

  if (eventIds.length > 0) {
    const { data: timelineEvidenceRows, error: timelineEvidenceError } = await supabase
      .from("timeline_event_evidence")
      .select(
        `
        timeline_event_id,
        evidence_file_id,
        evidence_files ( id, original_filename )
      `,
      )
      .in("timeline_event_id", eventIds);

    if (timelineEvidenceError) {
      timelineEvidenceWarning = "Linked evidence is temporarily unavailable. Timeline events are shown without attachments.";
    } else {
      evidenceByEvent = (timelineEvidenceRows ?? []).reduce((map, row) => {
        const typedRow = row as unknown as TimelineEvidenceRow;
        const existing = map.get(typedRow.timeline_event_id) ?? [];
        existing.push({
          evidence_file_id: typedRow.evidence_file_id,
          evidence_files: typedRow.evidence_files,
        });
        map.set(typedRow.timeline_event_id, existing);
        return map;
      }, new Map<string, TimelineRow["timeline_event_evidence"]>());
    }
  }

  const rawList: TimelineRow[] = eventRows.map((row) => ({
    id: row.id,
    title: row.title ?? "Untitled event",
    summary: row.summary ?? null,
    occurred_at: row.occurred_at ?? null,
    evidence_file_id: row.evidence_file_id ?? null,
    timeline_tier: row.timeline_tier ?? null,
    timeline_kind: row.timeline_kind ?? null,
    custom_lane_label: row.custom_lane_label ?? null,
    source_label: row.source_label ?? null,
    event_classification: row.event_classification ?? null,
    event_reasoning: row.event_reasoning ?? null,
    event_limitations: row.event_limitations ?? null,
    authenticity_label: row.authenticity_label ?? null,
    timeline_event_evidence: evidenceByEvent.get(row.id) ?? [],
  }));
  const needle = (q ?? "").trim().toLowerCase();
  let timelineFiltered = needle
    ? rawList.filter((ev) => {
        const blob = `${ev.title}\n${ev.summary ?? ""}\n${ev.occurred_at ?? ""}\n${ev.source_label ?? ""}\n${ev.event_classification ?? ""}`.toLowerCase();
        return blob.includes(needle);
      })
    : rawList;

  if (year?.trim()) {
    const y = year.trim();
    timelineFiltered = timelineFiltered.filter((ev) => String(ev.occurred_at ?? "").startsWith(y));
  }
  if (month?.trim()) {
    const m = month.trim();
    timelineFiltered = timelineFiltered.filter((ev) => String(ev.occurred_at ?? "").startsWith(m));
  }
  if (week?.trim()) {
    const wk = week.trim().toUpperCase();
    timelineFiltered = timelineFiltered.filter((ev) => {
      if (!ev.occurred_at) return false;
      const d = new Date(ev.occurred_at);
      if (Number.isNaN(d.getTime())) return false;
      return isoWeekKey(d) === wk;
    });
  }
  if (customLane?.trim()) {
    const lane = customLane.trim().toLowerCase();
    timelineFiltered = timelineFiltered.filter(
      (ev) => normalizeTimelineKind(ev.timeline_kind) === "custom" && String(ev.custom_lane_label ?? "").toLowerCase() === lane,
    );
  }

  timelineFiltered.sort(sortByOccurred);

  const conflictInputs = timelineFiltered
    .filter((ev) => (ev.timeline_kind ?? "evidence") !== "reconstructed")
    .map((ev) => ({
      id: ev.id,
      title: ev.title,
      summary: ev.summary,
      occurred_at: ev.occurred_at,
      timeline_kind: normalizeTimelineKind(ev.timeline_kind),
    }));
  const conflictSignals = detectTimelineConflicts(conflictInputs);

  let placements: Record<string, string> = {};
  if (user?.id) {
    try {
      placements = Object.fromEntries(await listTheoryPlacementsForUser(supabase, caseId, user.id));
    } catch {
      placements = {};
    }
  }

  const { data: evFiles } = await supabase
    .from("evidence_files")
    .select("id, original_filename, created_at")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  const caseFiles: CaseFileRef[] = (evFiles ?? []).map((r) => ({
    id: r.id as string,
    original_filename: r.original_filename as string,
    created_at: r.created_at as string,
  }));

  const incidents: TimelineIncidentOption[] = parseIncidentEntries(
    (c as { incident_entries?: unknown }).incident_entries,
  ).map((e) => ({
    id: e.id,
    title: e.incident_title,
    description: e.description,
    date: e.date ?? null,
    year: e.year ?? null,
    people: e.people.map((p) => ({ name: p.name, role: p.role })),
  }));

  return (
    <div className="space-y-4">
      {timelineEventsWarning ? (
        <Alert className="border-amber-500/40 bg-amber-500/[0.06]">
          <AlertTitle className="text-sm">Timeline data warning</AlertTitle>
          <AlertDescription>{timelineEventsWarning}</AlertDescription>
        </Alert>
      ) : null}
      {timelineEvidenceWarning ? (
        <Alert className="border-amber-500/40 bg-amber-500/[0.06]">
          <AlertTitle className="text-sm">Evidence link warning</AlertTitle>
          <AlertDescription>{timelineEvidenceWarning}</AlertDescription>
        </Alert>
      ) : null}
      {needle ? (
        <p className="text-sm text-muted-foreground max-w-7xl">
          Filtered by search: “{q?.trim()}” —{" "}
          <Link href={`/cases/${caseId}/timeline`} className="underline text-sky-400/90">
            clear
          </Link>
        </p>
      ) : null}

      <CaseTimelineWorkspace
        caseId={caseId}
        caseTitle={c.title}
        userId={user?.id ?? null}
        events={timelineFiltered}
        conflicts={conflictSignals}
        initialPlacements={placements}
        initialSelectedLanes={initialSelectedLanes}
        caseFiles={caseFiles}
        incidents={incidents}
      />
    </div>
  );
}

function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
