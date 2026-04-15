"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { DashboardEvidencePreview, type DashboardEvidencePreviewRow } from "@/components/dashboard-evidence-preview";
import { DashboardTimelinePanel } from "@/components/dashboard-timeline-panel";
import type { DashboardMapMarker, DashboardTimelineEvent } from "@/lib/dashboard-command-types";
import { deriveDashboardMarkers, normalizeLocationToken } from "@/lib/dashboard-location-utils";
import { dispatchWorkspaceNoteContext } from "@/lib/workspace-note-links-bridge";
import { dispatchWorkspaceAiAttachEvidence } from "@/lib/workspace-evidence-ai-bridge";

const DashboardWorldMapPanel = dynamic(
  () =>
    import("@/components/dashboard-world-map-panel").then((mod) => mod.DashboardWorldMapPanel),
  {
    ssr: false,
    loading: () => (
      <section className="rounded-lg border border-sky-400/15 bg-gradient-to-br from-[#1c2838] via-[#1a2535] to-[#141d2b] p-2.5 text-slate-100">
        <p className="text-xs font-semibold text-slate-200">Locations</p>
        <div className="mt-1.5 flex h-[min(42vh,400px)] min-h-[220px] items-center justify-center rounded-md border border-slate-500/40 bg-slate-950/30 text-[11px] text-slate-400">
          Loading map…
        </div>
      </section>
    ),
  },
);

export function DashboardCommandCenter({
  evidenceRows,
  evidenceLoading = false,
  evidenceLoadError = null,
  casesForAssign,
  activeCaseId = null,
}: {
  evidenceRows: DashboardEvidencePreviewRow[];
  evidenceLoading?: boolean;
  evidenceLoadError?: string | null;
  casesForAssign: {
    id: string;
    title: string;
    incident_city?: string | null;
    incident_state?: string | null;
    investigation_started_at?: string | null;
    investigation_on_hold_at?: string | null;
  }[];
  activeCaseId?: string | null;
}) {
  const autoMarkers = useMemo(
    () =>
      deriveDashboardMarkers(
        evidenceRows.map((r) => ({
          id: r.id,
          case_id: r.case_id,
          original_filename: r.original_filename,
          source_platform: r.source_platform ?? null,
          source_program: r.source_program ?? null,
        })),
        casesForAssign,
        activeCaseId,
      ),
    [activeCaseId, casesForAssign, evidenceRows],
  );

  const [selectedEvidenceIds, setSelectedEvidenceIds] = useState<string[]>([]);
  const [userMarkers, setUserMarkers] = useState<DashboardMapMarker[]>([]);
  const [markerEvidenceLinks, setMarkerEvidenceLinks] = useState<Record<string, string[]>>({});
  const [markerEvidenceUnlinks, setMarkerEvidenceUnlinks] = useState<Record<string, string[]>>({});
  const [timelineEvents, setTimelineEvents] = useState<DashboardTimelineEvent[]>([]);
  const [activeMarkerId, setActiveMarkerId] = useState<string | null>(null);
  const [activeEventId, setActiveEventId] = useState<string | null>(null);
  const [locationFilterKey, setLocationFilterKey] = useState<string | null>(null);

  const allMarkers = useMemo(
    () =>
      [...autoMarkers, ...userMarkers].map((m) => {
        const added = markerEvidenceLinks[m.id] ?? [];
        const removed = new Set(markerEvidenceUnlinks[m.id] ?? []);
        const merged = [...new Set([...(m.linkedEvidenceIds ?? []), ...added])].filter((id) => !removed.has(id));
        return { ...m, linkedEvidenceIds: merged };
      }),
    [autoMarkers, markerEvidenceLinks, markerEvidenceUnlinks, userMarkers],
  );
  const markerById = useMemo(() => new Map(allMarkers.map((m) => [m.id, m])), [allMarkers]);
  const evidenceLookup = useMemo(
    () =>
      new Map(
        evidenceRows.map((row) => [
          row.id,
          {
            id: row.id,
            label: row.display_filename?.trim() || row.original_filename,
            href: row.case_id ? `/cases/${row.case_id}/evidence/${row.id}` : `/evidence/${row.id}`,
            caseId: row.case_id,
          },
        ]),
      ),
    [evidenceRows],
  );
  const timelineCountByMarkerId = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const marker of allMarkers) {
      acc[marker.id] = timelineEvents.filter(
        (e) => e.markerId === marker.id || (!!e.locationKey && e.locationKey === marker.locationKey),
      ).length;
    }
    return acc;
  }, [allMarkers, timelineEvents]);

  const activeCase = useMemo(
    () => casesForAssign.find((c) => c.id === activeCaseId) ?? null,
    [activeCaseId, casesForAssign],
  );
  const activeCaseStatus = activeCase
    ? activeCase.investigation_on_hold_at
      ? "On hold"
      : activeCase.investigation_started_at
        ? "Active"
        : "Not started"
    : "No case selected";

  function addEvidenceToTimeline(ids: string[]) {
    if (ids.length === 0) return;
    if (activeEventId) {
      setTimelineEvents((prev) =>
        prev.map((ev) =>
          ev.id === activeEventId ? { ...ev, linkedEvidenceIds: [...new Set([...ev.linkedEvidenceIds, ...ids])] } : ev,
        ),
      );
      return;
    }
    const now = new Date();
    setTimelineEvents((prev) => [
      {
        id: `user-ev-${now.getTime()}`,
        title: `Linked evidence event (${ids.length} items)`,
        whenLabel: now.toLocaleString(),
        approx: false,
        occurredAt: now.toISOString(),
        createdAtMs: now.getTime(),
        locationKey: null,
        markerId: null,
        linkedEvidenceIds: ids,
        linkedCaseIds: [
          ...new Set(ids.map((id) => evidenceRows.find((r) => r.id === id)?.case_id).filter(Boolean) as string[]),
        ],
      },
      ...prev,
    ]);
  }

  function onSelectMarker(markerId: string | null) {
    setActiveMarkerId(markerId);
    setActiveEventId(null);
    if (!markerId) {
      setLocationFilterKey(null);
      return;
    }
    const marker = markerById.get(markerId);
    if (!marker) return;
    setLocationFilterKey(marker.locationKey);
    const firstRelated = timelineEvents.find((ev) => ev.markerId === markerId || ev.locationKey === marker.locationKey);
    if (firstRelated) setActiveEventId(firstRelated.id);
  }

  function onSelectTimelineEvent(eventId: string | null) {
    setActiveEventId(eventId);
    if (!eventId) return;
    const ev = timelineEvents.find((t) => t.id === eventId);
    if (!ev) return;
    setSelectedEvidenceIds(ev.linkedEvidenceIds);
    if (ev.markerId) {
      setActiveMarkerId(ev.markerId);
      const marker = markerById.get(ev.markerId);
      if (marker) setLocationFilterKey(marker.locationKey);
      return;
    }
    setActiveMarkerId(null);
    if (ev.locationKey) setLocationFilterKey(ev.locationKey);
  }

  function addEvidenceToMap(ids: string[]) {
    if (ids.length === 0) return;
    if (activeMarkerId) {
      setMarkerEvidenceLinks((prev) => ({
        ...prev,
        [activeMarkerId]: [...new Set([...(prev[activeMarkerId] ?? []), ...ids])],
      }));
      setMarkerEvidenceUnlinks((prev) => {
        const next = { ...prev };
        if (next[activeMarkerId]) {
          const removed = new Set(next[activeMarkerId]);
          ids.forEach((id) => removed.delete(id));
          next[activeMarkerId] = [...removed];
        }
        return next;
      });
      return;
    }
    const linkedCaseIds = [
      ...new Set(ids.map((id) => evidenceRows.find((r) => r.id === id)?.case_id).filter(Boolean) as string[]),
    ];
    setUserMarkers((prev) => [
      {
        id: `usr-${Date.now()}`,
        label: "User linked location",
        lat: 20,
        lon: 0,
        kind: "user",
        markerTypeLabel: "user-added",
        locationKey: "user linked location",
        linkedEvidenceIds: ids,
        linkedCaseIds,
      },
      ...prev,
    ]);
  }

  function clearAllSyncState() {
    setActiveMarkerId(null);
    setActiveEventId(null);
    setLocationFilterKey(null);
    setSelectedEvidenceIds([]);
  }

  useEffect(() => {
    if (selectedEvidenceIds.length !== 1) return;
    const evidenceId = selectedEvidenceIds[0]!;
    const relatedEvent = timelineEvents.find((ev) => ev.linkedEvidenceIds.includes(evidenceId));
    if (relatedEvent) {
      setActiveEventId(relatedEvent.id);
      if (relatedEvent.markerId) setActiveMarkerId(relatedEvent.markerId);
      if (relatedEvent.locationKey) setLocationFilterKey(relatedEvent.locationKey);
      return;
    }
    const relatedMarker = allMarkers.find((m) => m.linkedEvidenceIds.includes(evidenceId));
    if (relatedMarker) {
      setActiveMarkerId(relatedMarker.id);
      setLocationFilterKey(relatedMarker.locationKey);
      setActiveEventId(null);
    }
  }, [allMarkers, selectedEvidenceIds, timelineEvents]);

  useEffect(() => {
    const marker = activeMarkerId ? markerById.get(activeMarkerId) ?? null : null;
    dispatchWorkspaceNoteContext({
      caseId: activeCaseId ?? null,
      selectedEvidenceIds,
      activeTimelineEventId: activeEventId,
      activeMarkerId,
      activeLocationLabel: marker?.label ?? null,
    });
    if (selectedEvidenceIds.length > 0) {
      dispatchWorkspaceAiAttachEvidence({
        caseId: activeCaseId ?? selectedEvidenceIds.map((id) => evidenceLookup.get(id)?.caseId).find(Boolean) ?? null,
        evidenceIds: selectedEvidenceIds,
      });
    }
  }, [activeCaseId, activeEventId, activeMarkerId, evidenceLookup, markerById, selectedEvidenceIds]);

  useEffect(() => {
    if (locationFilterKey) return;
    if (!activeMarkerId && !activeEventId) return;
    if (activeMarkerId && !markerById.has(activeMarkerId)) setActiveMarkerId(null);
    if (activeEventId && !timelineEvents.some((ev) => ev.id === activeEventId)) setActiveEventId(null);
  }, [activeEventId, activeMarkerId, locationFilterKey, markerById, timelineEvents]);

  const panelSurface =
    "rounded-lg border border-sky-400/15 bg-gradient-to-br from-[#1c2838] via-[#1a2535] to-[#141d2b] text-slate-100 shadow-[0_0_0_1px_rgba(125,211,252,0.06),0_18px_50px_-22px_rgba(0,0,0,0.55)]";

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <section className={`${panelSurface} px-3 py-2`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-50">
              {activeCase ? activeCase.title : "No case in URL — open a case or use ?caseId="}
            </p>
            <p className="text-[11px] text-slate-400">
              <span className="text-slate-500">Status</span>{" "}
              <span className="font-medium text-slate-200">{activeCaseStatus}</span>
            </p>
          </div>
          {activeCase ? (
            <a
              href={`/cases/${activeCase.id}`}
              className="inline-flex h-8 shrink-0 items-center rounded-md border border-sky-400/25 bg-sky-500/10 px-3 text-xs font-medium text-sky-100 shadow-[0_0_20px_-8px_rgba(56,189,248,0.5)] hover:bg-sky-500/20"
            >
              Open case workspace
            </a>
          ) : null}
        </div>
      </section>

      <div className="grid min-h-0 gap-2 lg:grid-cols-12 lg:items-start">
        <div className="min-h-0 lg:col-span-3 lg:sticky lg:top-4 lg:self-start">
          <DashboardWorldMapPanel
            className={panelSurface}
            markers={allMarkers}
            evidenceLookup={evidenceLookup}
            activeMarkerId={activeMarkerId}
            filteredLocationKey={locationFilterKey}
            timelineCountByMarkerId={timelineCountByMarkerId}
            onSelectMarker={onSelectMarker}
            onClearSelection={clearAllSyncState}
            onAddUserMarker={(draft) => {
              setUserMarkers((prev) => [
                {
                  id: `usr-${Date.now()}`,
                  label: draft.name,
                  lat: draft.lat,
                  lon: draft.lng,
                  kind: "user",
                  markerTypeLabel: "user-added",
                  locationKey: normalizeLocationToken(draft.name),
                  linkedEvidenceIds: selectedEvidenceIds,
                  linkedCaseIds: [
                    ...new Set(
                      selectedEvidenceIds.map((id) => evidenceRows.find((r) => r.id === id)?.case_id).filter(Boolean) as string[],
                    ),
                  ],
                },
                ...prev,
              ]);
            }}
            onUnlinkEvidence={(markerId, evidenceId) => {
              setMarkerEvidenceUnlinks((prev) => ({
                ...prev,
                [markerId]: [...new Set([...(prev[markerId] ?? []), evidenceId])],
              }));
              setMarkerEvidenceLinks((prev) => ({
                ...prev,
                [markerId]: (prev[markerId] ?? []).filter((id) => id !== evidenceId),
              }));
              setSelectedEvidenceIds((prev) => prev.filter((id) => id !== evidenceId));
            }}
          />
        </div>
        <div className="flex min-h-0 flex-col gap-2 lg:col-span-9">
          <DashboardEvidencePreview
            panelClassName={panelSurface}
            loading={evidenceLoading}
            loadError={evidenceLoadError}
            rows={
              locationFilterKey
                ? evidenceRows.filter((row) => {
                    const markerEvidence = new Set(
                      allMarkers.filter((m) => m.locationKey === locationFilterKey).flatMap((m) => m.linkedEvidenceIds),
                    );
                    return markerEvidence.size === 0 || markerEvidence.has(row.id);
                  })
                : evidenceRows
            }
            casesForAssign={casesForAssign}
            selectedIds={selectedEvidenceIds}
            onSelectedIdsChange={setSelectedEvidenceIds}
            onAddSelectionToTimeline={addEvidenceToTimeline}
            onAddSelectionToMap={addEvidenceToMap}
            activeEventId={activeEventId}
            activeMarkerId={activeMarkerId}
          />
          <DashboardTimelinePanel
            integrated
            panelClassName={panelSurface}
            events={timelineEvents}
            markers={allMarkers}
            evidenceOptions={[...evidenceLookup.values()]}
            activeEventId={activeEventId}
            activeLocationKey={locationFilterKey}
            onSelectEvent={onSelectTimelineEvent}
            onSetLocationFilter={setLocationFilterKey}
            onClearLocationFilter={clearAllSyncState}
            onAddEvent={(entry) => setTimelineEvents((prev) => [entry, ...prev])}
            onUnlinkEvidence={(eventId, evidenceId) => {
              setTimelineEvents((prev) =>
                prev.map((ev) =>
                  ev.id === eventId ? { ...ev, linkedEvidenceIds: ev.linkedEvidenceIds.filter((id) => id !== evidenceId) } : ev,
                ),
              );
              setSelectedEvidenceIds((prev) => prev.filter((id) => id !== evidenceId));
            }}
            onUpdateEvent={(eventId, patch) => {
              setTimelineEvents((prev) =>
                prev.map((ev) => {
                  if (ev.id !== eventId) return ev;
                  const explicitMarkerId =
                    patch.markerId === "none" ? null : patch.markerId !== undefined ? patch.markerId : ev.markerId;
                  const marker = explicitMarkerId ? markerById.get(explicitMarkerId) ?? null : null;
                  return {
                    ...ev,
                    title: patch.title ?? ev.title,
                    whenLabel: patch.whenLabel ?? ev.whenLabel,
                    occurredAt: patch.occurredAt ?? ev.occurredAt,
                    markerId: explicitMarkerId,
                    locationKey: explicitMarkerId ? marker?.locationKey ?? ev.locationKey : null,
                  };
                }),
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}

