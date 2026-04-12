import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCaseById } from "@/services/case-service";
import { normalizeTimelineKind } from "@/lib/timeline-kind-schema";
import { detectTimelineConflicts } from "@/lib/timeline-conflicts";
import { listTheoryPlacementsForUser } from "@/services/timeline-theory-service";
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
  searchParams: Promise<{ q?: string; kind?: string; compare?: string }>;
}) {
  const { caseId } = await params;
  const { q, kind: kindRaw, compare: compareRaw } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

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

  const { data: events, error } = await supabase
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
      authenticity_label,
      timeline_event_evidence (
        evidence_file_id,
        evidence_files ( id, original_filename )
      )
    `,
    )
    .eq("case_id", caseId)
    .order("occurred_at", { ascending: true, nullsFirst: false });

  if (error) throw new Error(error.message);

  const rawList = (events ?? []) as unknown as TimelineRow[];
  const needle = (q ?? "").trim().toLowerCase();
  const textFiltered = needle
    ? rawList.filter((ev) => {
        const blob = `${ev.title}\n${ev.summary ?? ""}\n${ev.occurred_at ?? ""}\n${ev.source_label ?? ""}\n${ev.event_classification ?? ""}`.toLowerCase();
        return blob.includes(needle);
      })
    : rawList;

  textFiltered.sort(sortByOccurred);

  const conflictInputs = textFiltered
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

  return (
    <div className="space-y-4">
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
        events={textFiltered}
        conflicts={conflictSignals}
        initialPlacements={placements}
        initialSelectedLanes={initialSelectedLanes}
        caseFiles={caseFiles}
      />
    </div>
  );
}
