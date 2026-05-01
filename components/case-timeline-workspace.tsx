"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useEffect, useTransition } from "react";
import {
  TIMELINE_KIND_ACCENT,
  TIMELINE_KIND_BG,
  TIMELINE_KIND_LABELS,
  TIMELINE_TIER_LABELS,
  type TimelineKind,
  type TimelineTier,
} from "@/types/analysis";
import { AuthenticityBadge } from "@/components/authenticity-badge";
import { normalizeTimelineKind } from "@/lib/timeline-kind-schema";
import type { TimelineConflictSignal } from "@/lib/timeline-conflicts";
import {
  MONTH_NAMES,
  parseEventDate,
  uniqueYearsFromDates,
  monthIndicesWithEventsInYear,
  weeksOfMonthWithEvents,
  weekOfMonth,
  formatDrillBreadcrumb,
  type DrillSelection,
} from "@/lib/timeline-drilldown";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  addIncidentsToTimelineAction,
  regenerateReconstructedTimelineAction,
  setTimelineEventWorkflowAction,
} from "@/app/(workspace)/cases/[caseId]/timeline/timeline-actions";
import { clearTheoryPlacementAction, saveTheoryPlacementAction } from "@/app/(workspace)/cases/[caseId]/timeline/theory-actions";
import { ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type WorkspaceTimelineEvent = {
  id: string;
  title: string;
  summary: string | null;
  occurred_at: string | null;
  evidence_file_id: string | null;
  timeline_tier: TimelineTier | null;
  timeline_kind: TimelineKind | null;
  custom_lane_label: string | null;
  source_label: string | null;
  event_classification: string | null;
  event_reasoning: string | null;
  event_limitations: string | null;
  authenticity_label: string | null;
  timeline_event_evidence: {
    evidence_file_id: string;
    evidence_files: { id: string; original_filename: string } | null;
  }[];
};

export type CaseFileRef = {
  id: string;
  original_filename: string;
  created_at: string;
};

export type TimelineIncidentOption = {
  id: string;
  title: string;
  description: string;
  date: string | null;
  year: number | null;
  people: { name: string; role: string }[];
};

type WorkspaceMode = "view" | "theory" | "research" | "reconstructed";

const KIND_ORDER: TimelineKind[] = [
  "witness",
  "subject_actor",
  "official",
  "evidence",
  "reconstructed",
  "custom",
];

/** View modes: dense calendar drill (list), swimlanes by perspective (lanes), full dated stack (spine). */
export type TimelineLayoutView = "list" | "lanes" | "spine";

const STANDARD_LANE_LABEL_ORDER = KIND_ORDER.map((k) => TIMELINE_KIND_LABELS[k]);

function sortLaneLabelKeys(keys: string[]): string[] {
  return [...keys].sort((a, b) => {
    const ia = STANDARD_LANE_LABEL_ORDER.indexOf(a);
    const ib = STANDARD_LANE_LABEL_ORDER.indexOf(b);
    if (ia !== -1 || ib !== -1) {
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    }
    return a.localeCompare(b);
  });
}

type Phase = "year" | "month" | "week" | "day" | "events" | "undated";

function laneLabel(ev: WorkspaceTimelineEvent): string {
  const k = normalizeTimelineKind(ev.timeline_kind);
  if (k === "custom" && ev.custom_lane_label?.trim()) return ev.custom_lane_label.trim();
  return TIMELINE_KIND_LABELS[k];
}

function isCorrelated(ev: WorkspaceTimelineEvent): boolean {
  return /\bcorrelated\b/i.test(ev.event_classification ?? "");
}

function getEffectiveDate(
  ev: WorkspaceTimelineEvent,
  placements: Record<string, string>,
  useTheoryPlacement: boolean,
): Date | null {
  if (useTheoryPlacement && placements[ev.id]) {
    return parseEventDate(placements[ev.id]);
  }
  return parseEventDate(ev.occurred_at);
}

function eventInDrill(
  d: Date | null,
  phase: Phase,
  sel: DrillSelection,
): boolean {
  if (!d) return false;
  if (phase === "year") return sel.year != null && d.getFullYear() === sel.year;
  if (phase === "month")
    return sel.year != null && sel.monthIndex != null && d.getFullYear() === sel.year && d.getMonth() === sel.monthIndex;
  if (phase === "week")
    return (
      sel.year != null &&
      sel.monthIndex != null &&
      sel.weekOfMonth != null &&
      d.getFullYear() === sel.year &&
      d.getMonth() === sel.monthIndex &&
      weekOfMonth(d) === sel.weekOfMonth
    );
  if (phase === "day" || phase === "events")
    return (
      sel.year != null &&
      sel.monthIndex != null &&
      sel.weekOfMonth != null &&
      sel.day != null &&
      d.getFullYear() === sel.year &&
      d.getMonth() === sel.monthIndex &&
      weekOfMonth(d) === sel.weekOfMonth &&
      d.getDate() === sel.day
    );
  return false;
}

/** Events matching the selected calendar span (for evidence panel + research stacks). */
function eventsInSpan(
  events: WorkspaceTimelineEvent[],
  placements: Record<string, string>,
  useTheoryPlacement: boolean,
  sel: DrillSelection,
  phase: Phase,
  undatedMode: boolean,
): WorkspaceTimelineEvent[] {
  if (undatedMode) {
    return events.filter((ev) => getEffectiveDate(ev, placements, useTheoryPlacement) === null);
  }
  if (sel.year == null) return [];

  return events.filter((ev) => {
    const d = getEffectiveDate(ev, placements, useTheoryPlacement);
    if (!d) return false;
    if (phase === "year" || phase === "month") {
      return d.getFullYear() === sel.year;
    }
    if (phase === "week") {
      return (
        d.getFullYear() === sel.year &&
        sel.monthIndex != null &&
        d.getMonth() === sel.monthIndex
      );
    }
    if (phase === "day") {
      return (
        d.getFullYear() === sel.year &&
        sel.monthIndex != null &&
        d.getMonth() === sel.monthIndex &&
        sel.weekOfMonth != null &&
        weekOfMonth(d) === sel.weekOfMonth
      );
    }
    if (phase === "events") {
      return eventInDrill(d, "events", sel);
    }
    return false;
  });
}

export function CaseTimelineWorkspace({
  caseId,
  caseTitle: _caseTitle,
  userId,
  events,
  conflicts,
  initialPlacements,
  initialSelectedLanes,
  caseFiles,
  incidents = [],
}: {
  caseId: string;
  caseTitle: string;
  userId: string | null;
  events: WorkspaceTimelineEvent[];
  conflicts: TimelineConflictSignal[];
  initialPlacements: Record<string, string>;
  initialSelectedLanes: TimelineKind[];
  caseFiles?: CaseFileRef[];
  incidents?: TimelineIncidentOption[];
}) {
  const router = useRouter();
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>("view");
  const [placements, setPlacements] = useState(initialPlacements);
  const [selectedLanes, setSelectedLanes] = useState<Set<TimelineKind>>(
    () => new Set(initialSelectedLanes.length ? initialSelectedLanes : KIND_ORDER),
  );

  const [phase, setPhase] = useState<Phase>("year");
  const [sel, setSel] = useState<DrillSelection>({
    year: null,
    monthIndex: null,
    weekOfMonth: null,
    day: null,
  });
  const [undatedMode, setUndatedMode] = useState(false);
  const [layoutView, setLayoutView] = useState<TimelineLayoutView>("list");
  const [addIncidentsOpen, setAddIncidentsOpen] = useState(false);
  const [selectedIncidentIds, setSelectedIncidentIds] = useState<Set<string>>(() => new Set());
  const [incidentMode, setIncidentMode] = useState<"confirmed" | "theory" | "timeline_by_person">("confirmed");
  const [personByIncidentId, setPersonByIncidentId] = useState<Record<string, string>>({});

  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    setPlacements(initialPlacements);
  }, [initialPlacements]);

  const useTheoryPlacement = workspaceMode === "theory";

  const filteredByLane = useMemo(() => {
    return events.filter((ev) => {
      const k = normalizeTimelineKind(ev.timeline_kind);
      if (workspaceMode === "reconstructed") {
        return k === "reconstructed";
      }
      return selectedLanes.has(k);
    });
  }, [events, selectedLanes, workspaceMode]);

  const effectiveDates = useMemo(
    () => filteredByLane.map((ev) => getEffectiveDate(ev, placements, useTheoryPlacement)),
    [filteredByLane, placements, useTheoryPlacement],
  );

  const drillFiltered = useMemo(() => {
    if (undatedMode) {
      return filteredByLane.filter((ev) => getEffectiveDate(ev, placements, useTheoryPlacement) === null);
    }
    if (phase === "year" && sel.year == null) return [];
    return filteredByLane.filter((ev) => {
      const d = getEffectiveDate(ev, placements, useTheoryPlacement);
      return eventInDrill(d, phase, sel);
    });
  }, [filteredByLane, phase, sel, undatedMode, placements, useTheoryPlacement]);

  const spanForEvidence = useMemo(
    () =>
      eventsInSpan(filteredByLane, placements, useTheoryPlacement, sel, phase, undatedMode),
    [filteredByLane, placements, useTheoryPlacement, sel, phase, undatedMode],
  );

  const years = useMemo(() => uniqueYearsFromDates(effectiveDates), [effectiveDates]);

  const eventsByLaneLabel = useMemo(() => {
    const m = new Map<string, WorkspaceTimelineEvent[]>();
    for (const ev of filteredByLane) {
      const lab = laneLabel(ev);
      const arr = m.get(lab) ?? [];
      arr.push(ev);
      m.set(lab, arr);
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => {
        const da = getEffectiveDate(a, placements, useTheoryPlacement)?.getTime() ?? 0;
        const db = getEffectiveDate(b, placements, useTheoryPlacement)?.getTime() ?? 0;
        return da - db;
      });
    }
    return m;
  }, [filteredByLane, placements, useTheoryPlacement]);

  const spineSortedEvents = useMemo(() => {
    return [...filteredByLane].sort((a, b) => {
      const da = getEffectiveDate(a, placements, useTheoryPlacement)?.getTime() ?? 0;
      const db = getEffectiveDate(b, placements, useTheoryPlacement)?.getTime() ?? 0;
      return da - db;
    });
  }, [filteredByLane, placements, useTheoryPlacement]);

  const evidencePanelItems = useMemo(() => {
    const map = new Map<
      string,
      { id: string; filename: string; relatedTitles: string[]; source: "timeline" | "upload" }
    >();
    const sourceEvents = phase === "year" && sel.year == null ? [] : spanForEvidence;

    for (const ev of sourceEvents) {
      for (const row of ev.timeline_event_evidence ?? []) {
        const id = row.evidence_file_id;
        const fn = row.evidence_files?.original_filename ?? id;
        const cur = map.get(id);
        if (cur) {
          if (!cur.relatedTitles.includes(ev.title)) cur.relatedTitles.push(ev.title);
        } else {
          map.set(id, { id, filename: fn, relatedTitles: [ev.title], source: "timeline" });
        }
      }
    }

    if (workspaceMode === "research" && caseFiles?.length && sel.year != null) {
      let start = new Date(sel.year, 0, 1);
      let end = new Date(sel.year, 11, 31, 23, 59, 59, 999);
      if (sel.monthIndex != null) {
        start = new Date(sel.year, sel.monthIndex, 1);
        end = new Date(sel.year, sel.monthIndex + 1, 0, 23, 59, 59, 999);
      }
      if (sel.day != null && sel.monthIndex != null) {
        start = new Date(sel.year, sel.monthIndex, sel.day);
        end = new Date(sel.year, sel.monthIndex, sel.day, 23, 59, 59, 999);
      }
      for (const f of caseFiles) {
        const c = new Date(f.created_at);
        if (c >= start && c <= end && !map.has(f.id)) {
          map.set(f.id, {
            id: f.id,
            filename: f.original_filename,
            relatedTitles: ["(upload timestamp in selected span)"],
            source: "upload",
          });
        }
      }
    }

    return [...map.values()].sort((a, b) => a.filename.localeCompare(b.filename));
  }, [spanForEvidence, workspaceMode, caseFiles, sel, phase]);

  const personOptions = useMemo(
    () =>
      [...new Set(incidents.flatMap((inc) => inc.people.map((p) => p.name.trim()).filter(Boolean)))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [incidents],
  );
  const linkedIncidentIds = useMemo(() => {
    const set = new Set<string>();
    for (const ev of events) {
      const src = ev.source_label?.trim() ?? "";
      if (src.startsWith("Incident:")) set.add(src.slice("Incident:".length));
    }
    return set;
  }, [events]);

  const toggleLane = (k: TimelineKind) => {
    setSelectedLanes((prev) => {
      const next = new Set(prev);
      if (next.has(k)) {
        if (next.size > 1) next.delete(k);
      } else {
        next.add(k);
      }
      return next;
    });
  };

  const resetDrill = () => {
    setPhase("year");
    setSel({ year: null, monthIndex: null, weekOfMonth: null, day: null });
    setUndatedMode(false);
  };

  const toggleIncidentSelection = (incidentId: string) => {
    setSelectedIncidentIds((prev) => {
      const next = new Set(prev);
      if (next.has(incidentId)) next.delete(incidentId);
      else next.add(incidentId);
      return next;
    });
  };

  const saveIncidentSelections = () => {
    if (!selectedIncidentIds.size || !userId) return;
    const payload = [...selectedIncidentIds].map((incidentId) => ({
      incidentId,
      mode: incidentMode,
      personName: incidentMode === "timeline_by_person" ? personByIncidentId[incidentId] ?? null : null,
    }));
    const fd = new FormData();
    fd.set("caseId", caseId);
    fd.set("selections", JSON.stringify(payload));
    startTransition(() => {
      void addIncidentsToTimelineAction(fd).then(() => {
        setAddIncidentsOpen(false);
        setSelectedIncidentIds(new Set());
        router.refresh();
      });
    });
  };

  const breadcrumb = undatedMode
    ? "Undated events"
    : formatDrillBreadcrumb(sel) + (phase === "events" ? " → Events" : "");

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <p className="text-sm text-muted-foreground">
          <button
            type="button"
            onClick={() => router.push(caseId ? `/cases/${caseId}` : "/cases")}
            className="hover:underline"
          >
            ← Back to case
          </button>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">Timeline workspace</h1>
        <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
          Parallel timelines, calendar drill-down, and modes. Database dates are unchanged; Theory mode stores
          hypothesis times separately.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            {
              id: "confirmed" as const,
              label: "Confirmed",
              onClick: () => {
                setWorkspaceMode("view");
                setLayoutView("list");
                setSelectedLanes(new Set(KIND_ORDER));
                resetDrill();
              },
            },
            {
              id: "theory" as const,
              label: "Theory",
              onClick: () => {
                setWorkspaceMode("theory");
                setLayoutView("list");
                setSelectedLanes(new Set(KIND_ORDER));
                resetDrill();
              },
            },
            {
              id: "timeline_by_person" as const,
              label: "Timeline by Person",
              onClick: () => {
                setWorkspaceMode("view");
                setLayoutView("lanes");
                setSelectedLanes(new Set(["witness", "subject_actor", "custom"]));
                resetDrill();
              },
            },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={opt.onClick}
            className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
              (opt.id === "theory" && workspaceMode === "theory") ||
              (opt.id === "timeline_by_person" &&
                workspaceMode === "view" &&
                layoutView === "lanes" &&
                selectedLanes.has("custom")) ||
              (opt.id === "confirmed" && workspaceMode === "view" && layoutView === "list")
                ? "border-foreground/30 bg-foreground/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {opt.label}
          </button>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAddIncidentsOpen(true)}
          disabled={!userId || incidents.length === 0}
          className="text-xs"
        >
          Add from incidents
        </Button>
      </div>

      {workspaceMode !== "reconstructed" ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Timelines</p>
          <div className="flex flex-wrap gap-2">
            {KIND_ORDER.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => toggleLane(k)}
                className={`text-xs rounded-md border px-2.5 py-1 transition-colors ${
                  selectedLanes.has(k)
                    ? `border-primary/50 bg-primary/10 text-foreground`
                    : "border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 align-middle ${TIMELINE_KIND_BG[k]}`} />
                {TIMELINE_KIND_LABELS[k]}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {userId ? (
        <form action={regenerateReconstructedTimelineAction}>
          <input type="hidden" name="caseId" value={caseId} />
          <Button type="submit" variant="secondary" size="sm" className="text-xs">
            Regenerate reconstructed overview
          </Button>
        </form>
      ) : null}

      <Dialog open={addIncidentsOpen} onOpenChange={setAddIncidentsOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Add incidents to timeline</DialogTitle>
            <DialogDescription>
              Select one or more incidents and save them directly to the timeline. Existing linked incidents are updated.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  { id: "confirmed", label: "Confirmed" },
                  { id: "theory", label: "Theory" },
                  { id: "timeline_by_person", label: "Timeline by Person" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setIncidentMode(opt.id)}
                  className={`rounded-md border px-3 py-1.5 text-xs font-medium ${
                    incidentMode === opt.id
                      ? "border-foreground/30 bg-foreground/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {incidents.map((inc) => {
              const checked = selectedIncidentIds.has(inc.id);
              const alreadyLinked = linkedIncidentIds.has(inc.id);
              return (
                <label key={inc.id} className="block rounded-md border border-border bg-panel/30 p-3">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={checked}
                      onChange={() => toggleIncidentSelection(inc.id)}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-foreground">
                        {inc.title.trim() || "Untitled incident"}
                      </div>
                      <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                        {inc.date ? `Date: ${inc.date}` : inc.year != null ? `Approx year: ${inc.year}` : "No date set"}
                        {alreadyLinked ? (
                          <span className="rounded border border-emerald-400/50 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
                            Already on timeline (will update)
                          </span>
                        ) : null}
                      </div>
                      {inc.description.trim() ? (
                        <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{inc.description}</p>
                      ) : null}
                      {incidentMode === "timeline_by_person" && checked ? (
                        <select
                          className="mt-2 w-full rounded-md border border-input bg-form-field px-2 py-1 text-xs text-form-field-foreground"
                          value={personByIncidentId[inc.id] ?? ""}
                          onChange={(e) =>
                            setPersonByIncidentId((prev) => ({
                              ...prev,
                              [inc.id]: e.target.value,
                            }))
                          }
                        >
                          <option value="">Person timeline (generic)</option>
                          {inc.people
                            .map((p) => p.name.trim())
                            .filter(Boolean)
                            .filter((name, i, arr) => arr.indexOf(name) === i)
                            .map((name) => (
                              <option key={`${inc.id}-${name}`} value={name}>
                                {name}
                              </option>
                            ))}
                        </select>
                      ) : null}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAddIncidentsOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={saveIncidentSelections}
              disabled={!userId || selectedIncidentIds.size === 0 || isPending}
            >
              Save to timeline
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {conflicts.length > 0 ? (
        <Alert className="border-amber-500/40 bg-amber-500/[0.06]">
          <AlertTitle className="text-sm">Cross-timeline conflict signals</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4 mt-2 space-y-1 text-xs text-muted-foreground">
              {conflicts.slice(0, 10).map((c, i) => (
                <li key={`${c.eventAId}-${c.eventBId}-${i}`}>{c.summary}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_min(100%,380px)] gap-6 items-start">
        {layoutView === "list" ? (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Calendar</CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2 text-xs">
              <span>{breadcrumb}</span>
              {(phase !== "year" || undatedMode || sel.year != null) && (
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={resetDrill}>
                  Reset to years
                </Button>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!filteredByLane.length ? (
              <p className="text-sm text-muted-foreground">No events for the selected timelines.</p>
            ) : undatedMode ? (
              <EventList
                caseId={caseId}
                events={drillFiltered}
                personOptions={personOptions}
                workspaceMode={workspaceMode}
                placements={placements}
                useTheoryPlacement={useTheoryPlacement}
                onPlacementSaved={(id, iso) => setPlacements((p) => ({ ...p, [id]: iso }))}
                onPlacementCleared={(id) =>
                  setPlacements((p) => {
                    const n = { ...p };
                    delete n[id];
                    return n;
                  })
                }
                userId={userId}
                isPending={isPending}
                startTransition={startTransition}
              />
            ) : phase === "year" ? (
              <YearGrid
                years={years}
                undatedCount={
                  filteredByLane.filter((ev) => getEffectiveDate(ev, placements, useTheoryPlacement) === null).length
                }
                onPickYear={(y) => {
                  setSel({ year: y, monthIndex: null, weekOfMonth: null, day: null });
                  setPhase("month");
                  setUndatedMode(false);
                }}
                onPickUndated={() => {
                  setUndatedMode(true);
                  setPhase("events");
                }}
                counts={years.reduce(
                  (acc, y) => {
                    acc[y] = effectiveDates.filter((d) => d && d.getFullYear() === y).length;
                    return acc;
                  },
                  {} as Record<number, number>,
                )}
              />
            ) : phase === "month" && sel.year != null ? (
              <MonthGrid
                year={sel.year}
                months={monthIndicesWithEventsInYear(effectiveDates, sel.year)}
                onPickMonth={(m) => {
                  setSel((s) => ({ ...s, monthIndex: m, weekOfMonth: null, day: null }));
                  setPhase("week");
                }}
                onBack={() => {
                  setPhase("year");
                  setSel({ year: null, monthIndex: null, weekOfMonth: null, day: null });
                }}
              />
            ) : phase === "week" && sel.year != null && sel.monthIndex != null ? (
              <WeekRow
                weeks={weeksOfMonthWithEvents(effectiveDates, sel.year, sel.monthIndex)}
                onPickWeek={(w) => {
                  setSel((s) => ({ ...s, weekOfMonth: w, day: null }));
                  setPhase("day");
                }}
                onBack={() => setPhase("month")}
              />
            ) : phase === "day" && sel.year != null && sel.monthIndex != null && sel.weekOfMonth != null ? (
              <DayRow
                days={
                  effectiveDates
                    .map((d, i) => ({ d, ev: filteredByLane[i] }))
                    .filter(
                      ({ d }) =>
                        d &&
                        sel.year != null &&
                        sel.monthIndex != null &&
                        sel.weekOfMonth != null &&
                        d.getFullYear() === sel.year &&
                        d.getMonth() === sel.monthIndex &&
                        weekOfMonth(d) === sel.weekOfMonth,
                    )
                    .map(({ d }) => d!.getDate())
                    .filter((v, i, a) => a.indexOf(v) === i)
                    .sort((a, b) => a - b)
                }
                onPickDay={(d) => {
                  setSel((s) => ({ ...s, day: d }));
                  setPhase("events");
                }}
                onBack={() => setPhase("week")}
              />
            ) : phase === "events" && !undatedMode ? (
              <EventList
                caseId={caseId}
                events={drillFiltered}
                personOptions={personOptions}
                workspaceMode={workspaceMode}
                placements={placements}
                useTheoryPlacement={useTheoryPlacement}
                onPlacementSaved={(id, iso) => setPlacements((p) => ({ ...p, [id]: iso }))}
                onPlacementCleared={(id) =>
                  setPlacements((p) => {
                    const n = { ...p };
                    delete n[id];
                    return n;
                  })
                }
                userId={userId}
                isPending={isPending}
                startTransition={startTransition}
              />
            ) : null}
          </CardContent>
        </Card>
        ) : layoutView === "lanes" ? (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Horizontal lanes</CardTitle>
            <CardDescription className="text-xs">
              One band per timeline perspective; cards flow left to right in time order within each lane.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TimelineLanesView
              eventsByLane={eventsByLaneLabel}
              caseId={caseId}
              personOptions={personOptions}
              workspaceMode={workspaceMode}
              placements={placements}
              useTheoryPlacement={useTheoryPlacement}
              onPlacementSaved={(id, iso) => setPlacements((p) => ({ ...p, [id]: iso }))}
              onPlacementCleared={(id) =>
                setPlacements((p) => {
                  const n = { ...p };
                  delete n[id];
                  return n;
                })
              }
              userId={userId}
              isPending={isPending}
              startTransition={startTransition}
            />
          </CardContent>
        </Card>
        ) : (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Vertical spine</CardTitle>
            <CardDescription className="text-xs">
              All events matching the current lane filters, in one chronological column.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!filteredByLane.length ? (
              <p className="text-sm text-muted-foreground">No events for the selected timelines.</p>
            ) : (
              <EventList
                caseId={caseId}
                events={spineSortedEvents}
                personOptions={personOptions}
                workspaceMode={workspaceMode}
                placements={placements}
                useTheoryPlacement={useTheoryPlacement}
                onPlacementSaved={(id, iso) => setPlacements((p) => ({ ...p, [id]: iso }))}
                onPlacementCleared={(id) =>
                  setPlacements((p) => {
                    const n = { ...p };
                    delete n[id];
                    return n;
                  })
                }
                userId={userId}
                isPending={isPending}
                startTransition={startTransition}
              />
            )}
          </CardContent>
        </Card>
        )}

        <aside className="space-y-3 lg:sticky lg:top-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Evidence for this window</CardTitle>
              <CardDescription className="text-xs">
                {phase === "year" && sel.year == null && !undatedMode
                  ? "Pick a year (or undated) to attach evidence to a time span."
                  : "Timeline-linked files; Research mode can add uploads whose created time falls in the span."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[min(420px,50vh)] overflow-y-auto pr-2">
                {evidencePanelItems.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No evidence in this selection.</p>
                ) : (
                  <ul className="space-y-3 text-sm">
                    {evidencePanelItems.map((item) => (
                      <li key={item.id} className="rounded-md border border-border bg-muted/50 p-2">
                        <Link
                          href={`/cases/${caseId}/evidence/${item.id}`}
                          className="font-medium text-sky-400 hover:underline"
                        >
                          {item.filename}
                        </Link>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {item.source === "upload" ? "Research: upload time" : "Related events:"}{" "}
                          {item.relatedTitles.slice(0, 4).join(" · ")}
                          {item.relatedTitles.length > 4 ? "…" : ""}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function YearGrid({
  years,
  undatedCount,
  onPickYear,
  onPickUndated,
  counts,
}: {
  years: number[];
  undatedCount: number;
  onPickYear: (y: number) => void;
  onPickUndated: () => void;
  counts: Record<number, number>;
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Start at year level — select a year to open months.</p>
      {years.length === 0 && undatedCount === 0 ? (
        <p className="text-sm text-muted-foreground">No dated events in this filter.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {years.map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => onPickYear(y)}
              className="rounded-lg border border-border bg-panel px-3 py-4 text-left hover:border-primary/40 hover:bg-muted transition-colors"
            >
              <div className="text-lg font-semibold">{y}</div>
              <div className="text-[11px] text-muted-foreground">{counts[y] ?? 0} events</div>
            </button>
          ))}
        </div>
      )}
      {undatedCount > 0 ? (
        <button
          type="button"
          onClick={onPickUndated}
          className="w-full rounded-lg border border-dashed border-border px-3 py-3 text-left text-sm text-muted-foreground hover:bg-muted"
        >
          Undated events ({undatedCount}) <ChevronRight className="inline size-4 ml-1" />
        </button>
      ) : null}
    </div>
  );
}

function MonthGrid({
  year,
  months,
  onPickMonth,
  onBack,
}: {
  year: number;
  months: number[];
  onPickMonth: (m: number) => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-3">
      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onBack}>
        ← Years
      </Button>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {months.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onPickMonth(m)}
            className="rounded-lg border border-border bg-panel px-3 py-3 text-left hover:border-primary/40 text-sm"
          >
            {MONTH_NAMES[m]}
          </button>
        ))}
      </div>
    </div>
  );
}

function WeekRow({
  weeks,
  onPickWeek,
  onBack,
}: {
  weeks: number[];
  onPickWeek: (w: number) => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-3">
      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onBack}>
        ← Months
      </Button>
      <div className="flex flex-wrap gap-2">
        {weeks.map((w) => (
          <button
            key={w}
            type="button"
            onClick={() => onPickWeek(w)}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            Week {w}
          </button>
        ))}
      </div>
    </div>
  );
}

function DayRow({
  days,
  onPickDay,
  onBack,
}: {
  days: number[];
  onPickDay: (d: number) => void;
  onBack: () => void;
}) {
  return (
    <div className="space-y-3">
      <Button type="button" variant="ghost" size="sm" className="h-8 text-xs" onClick={onBack}>
        ← Weeks
      </Button>
      <div className="flex flex-wrap gap-2">
        {days.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => onPickDay(d)}
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-muted"
          >
            Day {d}
          </button>
        ))}
      </div>
    </div>
  );
}

function TimelineEventCard({
  caseId,
  ev,
  personOptions,
  workspaceMode,
  placements,
  useTheoryPlacement,
  onPlacementSaved,
  onPlacementCleared,
  userId,
  isPending,
  startTransition,
}: {
  caseId: string;
  ev: WorkspaceTimelineEvent;
  personOptions: string[];
  workspaceMode: WorkspaceMode;
  placements: Record<string, string>;
  useTheoryPlacement: boolean;
  onPlacementSaved: (id: string, iso: string) => void;
  onPlacementCleared: (id: string) => void;
  userId: string | null;
  isPending: boolean;
  startTransition: (cb: () => void) => void;
}) {
  const kind = normalizeTimelineKind(ev.timeline_kind);
  const accent = TIMELINE_KIND_ACCENT[kind];
  const tier = ev.timeline_tier;
  const locked = tier === "t1_confirmed";
  const canTheoryMove = !locked && (tier === "t2_supported" || tier === "t3_leads");
  const showCorr = workspaceMode === "reconstructed" && isCorrelated(ev);
  const hypVal = placements[ev.id] ? new Date(placements[ev.id]).toISOString().slice(0, 16) : "";
  const [personSelection, setPersonSelection] = useState("");

  const setWorkflow = (mode: "confirmed" | "theory" | "timeline_by_person") => {
    if (!userId) return;
    const fd = new FormData();
    fd.set("caseId", caseId);
    fd.set("eventId", ev.id);
    fd.set("mode", mode);
    if (mode === "timeline_by_person" && personSelection.trim()) {
      fd.set("personName", personSelection.trim());
    }
    startTransition(() => {
      void setTimelineEventWorkflowAction(fd);
    });
  };

  const saveHyp = () => {
    const el = document.getElementById(`hyp-${ev.id}`) as HTMLInputElement | null;
    if (!el?.value) return;
    const iso = new Date(el.value).toISOString();
    const fd = new FormData();
    fd.set("caseId", caseId);
    fd.set("eventId", ev.id);
    fd.set("provisionalOccurredAt", iso);
    startTransition(() => {
      void saveTheoryPlacementAction(fd).then(() => onPlacementSaved(ev.id, iso));
    });
  };

  const clearHyp = () => {
    const fd = new FormData();
    fd.set("caseId", caseId);
    fd.set("eventId", ev.id);
    startTransition(() => {
      void clearTheoryPlacementAction(fd).then(() => onPlacementCleared(ev.id));
    });
  };

  return (
    <div className={`rounded-lg border border-border border-l-4 ${accent} pl-3 pr-3 py-3 bg-panel`}>
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
        <span>{ev.occurred_at ? new Date(ev.occurred_at).toLocaleString() : "Undated (canonical)"}</span>
        <span className="rounded border border-border px-1.5 py-0.5">{laneLabel(ev)}</span>
        {tier ? (
          <span
            className={`rounded border px-1.5 py-0.5 ${
              tier === "t1_confirmed"
                ? "border-emerald-300 bg-emerald-50 text-emerald-950"
                : tier === "t2_supported"
                  ? showCorr
                    ? "border-amber-300 bg-amber-50 text-amber-950"
                    : "border-sky-300 bg-sky-50 text-sky-950"
                  : "border-border text-muted-foreground"
            }`}
          >
            {TIMELINE_TIER_LABELS[tier]}
            {showCorr ? " · Correlated" : ""}
          </span>
        ) : null}
        {ev.authenticity_label ? <AuthenticityBadge value={ev.authenticity_label} /> : null}
        {locked ? <span className="text-emerald-500/80">Locked (confirmed)</span> : null}
      </div>
      <div className="font-medium mt-1">{ev.title}</div>
      {ev.source_label ? <p className="text-[11px] text-muted-foreground">Source: {ev.source_label}</p> : null}
      {ev.summary ? <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{ev.summary}</p> : null}

      {workspaceMode === "theory" && userId && canTheoryMove ? (
        <div className="mt-2 flex flex-wrap items-end gap-2 text-xs">
          <label className="flex flex-col gap-1">
            <span className="text-[10px] text-muted-foreground">Hypothesis time</span>
            <input
              key={hypVal}
              type="datetime-local"
              defaultValue={hypVal}
              className="rounded border border-input bg-form-field px-2 py-1 text-xs text-black [color-scheme:light]"
              disabled={isPending}
              id={`hyp-${ev.id}`}
            />
          </label>
          <Button type="button" size="sm" variant="secondary" className="text-xs" disabled={isPending} onClick={saveHyp}>
            Save hypothesis
          </Button>
          <Button type="button" variant="ghost" size="sm" className="text-xs" disabled={isPending} onClick={clearHyp}>
            Clear
          </Button>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <Button type="button" size="sm" variant="secondary" disabled={!userId || isPending} onClick={() => setWorkflow("confirmed")}>
          Confirmed
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={!userId || isPending} onClick={() => setWorkflow("theory")}>
          Theory
        </Button>
        <select
          className="h-8 min-w-[9rem] rounded-md border border-input bg-form-field px-2 text-xs text-form-field-foreground"
          value={personSelection}
          onChange={(e) => setPersonSelection(e.target.value)}
          disabled={!userId || isPending}
        >
          <option value="">Person (optional)</option>
          {personOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!userId || isPending}
          onClick={() => setWorkflow("timeline_by_person")}
        >
          Timeline by Person
        </Button>
      </div>

      {workspaceMode === "theory" && placements[ev.id] ? (
        <p className="mt-1 text-[11px] text-amber-900">
          Hypothesis placement: {new Date(placements[ev.id]).toLocaleString()}
        </p>
      ) : null}

      <div className="mt-2 flex flex-wrap gap-2 text-xs">
        {(ev.timeline_event_evidence ?? []).map((row) => (
          <Link
            key={row.evidence_file_id}
            href={`/cases/${caseId}/evidence/${row.evidence_file_id}`}
            className="text-sky-400 hover:underline"
          >
            {row.evidence_files?.original_filename ?? row.evidence_file_id}
          </Link>
        ))}
      </div>
    </div>
  );
}

function TimelineLanesView({
  eventsByLane,
  caseId,
  personOptions,
  workspaceMode,
  placements,
  useTheoryPlacement,
  onPlacementSaved,
  onPlacementCleared,
  userId,
  isPending,
  startTransition,
}: {
  eventsByLane: Map<string, WorkspaceTimelineEvent[]>;
  caseId: string;
  personOptions: string[];
  workspaceMode: WorkspaceMode;
  placements: Record<string, string>;
  useTheoryPlacement: boolean;
  onPlacementSaved: (id: string, iso: string) => void;
  onPlacementCleared: (id: string) => void;
  userId: string | null;
  isPending: boolean;
  startTransition: (cb: () => void) => void;
}) {
  const keys = sortLaneLabelKeys([...eventsByLane.keys()]);
  if (keys.length === 0) {
    return <p className="text-sm text-muted-foreground">No events for the selected timelines.</p>;
  }
  return (
    <div className="space-y-6">
      {keys.map((lab) => (
        <section key={lab}>
          <h3 className="mb-2 border-b border-border pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {lab}
          </h3>
          <div className="flex flex-wrap gap-2">
            {(eventsByLane.get(lab) ?? []).map((ev) => (
              <div key={ev.id} className="min-w-[200px] flex-1 basis-[280px] max-w-lg">
                <TimelineEventCard
                  caseId={caseId}
                  ev={ev}
                  personOptions={personOptions}
                  workspaceMode={workspaceMode}
                  placements={placements}
                  useTheoryPlacement={useTheoryPlacement}
                  onPlacementSaved={onPlacementSaved}
                  onPlacementCleared={onPlacementCleared}
                  userId={userId}
                  isPending={isPending}
                  startTransition={startTransition}
                />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function EventList({
  caseId,
  events,
  personOptions,
  workspaceMode,
  placements,
  useTheoryPlacement,
  onPlacementSaved,
  onPlacementCleared,
  userId,
  isPending,
  startTransition,
}: {
  caseId: string;
  events: WorkspaceTimelineEvent[];
  personOptions: string[];
  workspaceMode: WorkspaceMode;
  placements: Record<string, string>;
  useTheoryPlacement: boolean;
  onPlacementSaved: (id: string, iso: string) => void;
  onPlacementCleared: (id: string) => void;
  userId: string | null;
  isPending: boolean;
  startTransition: (cb: () => void) => void;
}) {
  const sorted = [...events].sort((a, b) => {
    const da = getEffectiveDate(a, placements, useTheoryPlacement)?.getTime() ?? 0;
    const db = getEffectiveDate(b, placements, useTheoryPlacement)?.getTime() ?? 0;
    return da - db;
  });

  return (
    <ul className="space-y-4">
      {sorted.map((ev) => (
        <li key={ev.id}>
          <TimelineEventCard
            caseId={caseId}
            ev={ev}
            personOptions={personOptions}
            workspaceMode={workspaceMode}
            placements={placements}
            useTheoryPlacement={useTheoryPlacement}
            onPlacementSaved={onPlacementSaved}
            onPlacementCleared={onPlacementCleared}
            userId={userId}
            isPending={isPending}
            startTransition={startTransition}
          />
        </li>
      ))}
    </ul>
  );
}
