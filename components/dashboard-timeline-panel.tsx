"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarClock, Clock3, Link2, Plus, Send, SplitSquareHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DashboardMapMarker, DashboardTimelineEvent } from "@/lib/dashboard-command-types";
import { dispatchWorkspaceAiAttachEvidence } from "@/lib/workspace-evidence-ai-bridge";
import { cn } from "@/lib/utils";

type EvidenceOption = {
  id: string;
  label: string;
  href: string;
  caseId: string | null;
};

function eventSortValue(event: DashboardTimelineEvent): number {
  if (event.occurredAt) {
    const ms = Date.parse(event.occurredAt);
    if (!Number.isNaN(ms)) return ms;
  }
  return Number.MAX_SAFE_INTEGER - (event.createdAtMs ?? 0);
}

export function DashboardTimelinePanel({
  integrated = false,
  panelClassName,
  events,
  markers,
  evidenceOptions,
  activeEventId,
  activeLocationKey,
  onSelectEvent,
  onSetLocationFilter,
  onClearLocationFilter,
  onAddEvent,
  onUnlinkEvidence,
  onUpdateEvent,
}: {
  integrated?: boolean;
  panelClassName?: string;
  events: DashboardTimelineEvent[];
  markers: DashboardMapMarker[];
  evidenceOptions: EvidenceOption[];
  activeEventId: string | null;
  activeLocationKey: string | null;
  onSelectEvent: (eventId: string | null) => void;
  onSetLocationFilter: (locationKey: string | null) => void;
  onClearLocationFilter: () => void;
  onAddEvent: (event: DashboardTimelineEvent) => void;
  onUnlinkEvidence: (eventId: string, evidenceId: string) => void;
  onUpdateEvent: (
    eventId: string,
    patch: { title?: string; whenLabel?: string; occurredAt?: string | null; markerId?: string | "none" },
  ) => void;
}) {
  const [title, setTitle] = useState("");
  const [isApprox, setIsApprox] = useState(false);
  const [exactTime, setExactTime] = useState("");
  const [approxTime, setApproxTime] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedMarkerId, setSelectedMarkerId] = useState<string>("none");
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(!integrated);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editMarkerId, setEditMarkerId] = useState<string>("none");
  const listRef = useRef<HTMLUListElement | null>(null);

  const markerById = useMemo(() => new Map(markers.map((m) => [m.id, m])), [markers]);
  const evidenceById = useMemo(() => new Map(evidenceOptions.map((e) => [e.id, e])), [evidenceOptions]);
  const sortedEvents = useMemo(() => [...events].sort((a, b) => eventSortValue(a) - eventSortValue(b)), [events]);
  const visibleEvents = useMemo(
    () => (activeLocationKey ? sortedEvents.filter((e) => e.locationKey === activeLocationKey) : sortedEvents),
    [activeLocationKey, sortedEvents],
  );

  useEffect(() => {
    if (!activeEventId || !listRef.current) return;
    const node = listRef.current.querySelector<HTMLLIElement>(`li[data-event-id="${activeEventId}"]`);
    node?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeEventId, visibleEvents]);

  const canAdd = title.trim().length > 0 && (isApprox ? approxTime.trim().length > 0 : exactTime.trim().length > 0);

  const shellClass =
    panelClassName ??
    "rounded-lg border border-slate-500/75 bg-gradient-to-br from-slate-800 to-slate-900 text-slate-100 shadow-sm";

  function commitNewEvent() {
    if (!canAdd) return;
    const now = Date.now();
    const selectedMarker = selectedMarkerId === "none" ? null : markerById.get(selectedMarkerId) ?? null;
    onAddEvent({
      id: `manual-${now}`,
      title: title.trim(),
      whenLabel: isApprox ? approxTime.trim() : new Date(exactTime).toLocaleString(),
      approx: isApprox,
      occurredAt: isApprox ? null : new Date(exactTime).toISOString(),
      createdAtMs: now,
      locationKey: selectedMarker?.locationKey ?? null,
      markerId: selectedMarker?.id ?? null,
      linkedEvidenceIds: selectedMarker?.linkedEvidenceIds ?? [],
      linkedCaseIds: selectedMarker?.linkedCaseIds ?? [],
      notes: notes.trim() || undefined,
    });
    setTitle("");
    setExactTime("");
    setApproxTime("");
    setNotes("");
    setSelectedMarkerId("none");
    if (integrated) setComposerOpen(false);
  }

  const showComposer = !integrated || composerOpen;

  return (
    <section className={cn(shellClass, integrated ? "p-2.5" : "p-3")}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className={cn("font-semibold text-slate-100", integrated ? "text-xs" : "text-sm")}>Timeline</p>
        <div className="flex shrink-0 items-center gap-1.5">
          {integrated ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-slate-500/60 bg-slate-950/40 px-2 text-[10px] text-slate-100"
              onClick={() => setComposerOpen((v) => !v)}
            >
              {composerOpen ? "Hide form" : "New event"}
            </Button>
          ) : null}
          {activeLocationKey ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 border-slate-500/60 bg-slate-950/40 text-slate-100"
              onClick={onClearLocationFilter}
            >
              Clear filter
            </Button>
          ) : null}
        </div>
      </div>

      {showComposer ? (
        <div
          className={cn(
            "rounded-md border p-2",
            integrated ? "border-slate-500/40 bg-slate-950/35" : "border-slate-600/80 bg-slate-800/70",
          )}
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              className={cn(
                "h-8 text-slate-100",
                integrated ? "border-slate-500/60 bg-slate-950/80" : "border-slate-500 bg-slate-900",
              )}
            />
            {isApprox ? (
              <Input
                value={approxTime}
                onChange={(e) => setApproxTime(e.target.value)}
                placeholder="Approximate time"
                className={cn(
                  "h-8 text-slate-100",
                  integrated ? "border-slate-500/60 bg-slate-950/80" : "border-slate-500 bg-slate-900",
                )}
              />
            ) : (
              <Input
                type="datetime-local"
                value={exactTime}
                onChange={(e) => setExactTime(e.target.value)}
                className={cn(
                  "h-8 text-slate-100",
                  integrated ? "border-slate-500/60 bg-slate-950/80" : "border-slate-500 bg-slate-900",
                )}
              />
            )}
          </div>
          <div className="mt-1.5">
            <Select value={selectedMarkerId} onValueChange={setSelectedMarkerId}>
              <SelectTrigger
                className={cn(
                  "h-8 text-slate-100",
                  integrated ? "border-slate-500/60 bg-slate-950/80" : "border-slate-500 bg-slate-900",
                )}
              >
                <SelectValue placeholder={integrated ? "Location (optional)" : "Link location (optional)"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No linked location</SelectItem>
                {markers.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            className={cn(
              "mt-1.5 border-slate-500/60 text-slate-100",
              integrated ? "min-h-[44px] bg-slate-950/80 text-xs" : "min-h-[66px] border-slate-500 bg-slate-900",
            )}
          />
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className={cn(
                "h-8 text-slate-100",
                integrated ? "border-slate-500/60 bg-slate-900/60" : "border-slate-500 bg-slate-700",
              )}
              onClick={() => setIsApprox((v) => !v)}
            >
              {isApprox ? (integrated ? "Exact time" : "Use exact time") : integrated ? "Approx time" : "Use approximate time"}
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 bg-sky-600 text-white hover:bg-sky-500"
              disabled={!canAdd}
              onClick={commitNewEvent}
            >
              <Plus className="mr-1 h-3.5 w-3.5" />
              {integrated ? "Add" : "Add event"}
            </Button>
          </div>
        </div>
      ) : null}

      {visibleEvents.length === 0 ? (
        <div
          className={cn(
            "mt-2 rounded border px-2 py-1.5 text-[11px] text-slate-400",
            integrated ? "border-slate-600/50 bg-slate-950/30" : "border-slate-600/70 bg-slate-800/80 px-3 py-2 text-xs text-slate-300",
          )}
        >
          {integrated ? "No events yet — add one or link evidence from the list." : "No timeline links yet. Create an event or link selected evidence."}
        </div>
      ) : (
        <ul
          ref={listRef}
          className={cn(
            "mt-2 overflow-y-auto pr-1",
            integrated ? "max-h-[min(28vh,260px)] space-y-1.5" : "max-h-[340px] space-y-2",
          )}
        >
          {visibleEvents.map((ev) => {
            const relatedToActiveLocation = !!activeLocationKey && ev.locationKey === activeLocationKey;
            const evidenceRows = ev.linkedEvidenceIds.map((id) => evidenceById.get(id)).filter(Boolean) as EvidenceOption[];
            return (
              <li
                key={ev.id}
                data-event-id={ev.id}
                className={cn(
                  "rounded-md border",
                  integrated ? "px-1.5 py-1.5" : "px-2 py-2",
                  activeEventId === ev.id
                    ? "border-sky-300/95 bg-sky-900/25 shadow-[0_0_0_1px_rgba(125,211,252,0.7)]"
                    : relatedToActiveLocation
                      ? "border-amber-300/80 bg-amber-900/15"
                      : "border-slate-600/80 bg-slate-800/70",
                )}
              >
                {editingEventId === ev.id ? (
                  <div className="mb-2 space-y-2 rounded border border-slate-500/80 bg-slate-900/70 p-2">
                    <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-8 border-slate-500 bg-slate-950 text-slate-100" />
                    <Input
                      type="datetime-local"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="h-8 border-slate-500 bg-slate-950 text-slate-100"
                    />
                    <Select value={editMarkerId} onValueChange={setEditMarkerId}>
                      <SelectTrigger className="h-8 border-slate-500 bg-slate-950 text-slate-100">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No linked location</SelectItem>
                        {markers.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-7 bg-sky-700 text-white hover:bg-sky-600"
                        onClick={() => {
                          const parsed = editTime ? new Date(editTime) : null;
                          onUpdateEvent(ev.id, {
                            title: editTitle.trim() || ev.title,
                            whenLabel: parsed ? parsed.toLocaleString() : ev.whenLabel,
                            occurredAt: parsed ? parsed.toISOString() : ev.occurredAt ?? null,
                            markerId: editMarkerId,
                          });
                          setEditingEventId(null);
                        }}
                      >
                        Save
                      </Button>
                      <Button type="button" size="sm" variant="outline" className="h-7 border-slate-500 bg-slate-700 text-slate-100" onClick={() => setEditingEventId(null)}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : null}
                <button
                  type="button"
                  className="w-full text-left"
                  onClick={() => {
                    onSelectEvent(ev.id);
                    if (ev.locationKey) onSetLocationFilter(ev.locationKey);
                  }}
                >
                  <p className={cn("font-semibold text-slate-100", integrated ? "text-xs" : "text-sm")}>{ev.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-300">
                    {ev.approx ? <Clock3 className="mr-1 inline h-3 w-3" /> : <CalendarClock className="mr-1 inline h-3 w-3" />}
                    {ev.whenLabel}
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-300">
                    <Link2 className="mr-1 inline h-3 w-3 text-sky-300" />
                    Evidence {ev.linkedEvidenceIds.length}
                    {ev.locationKey ? " · location linked" : " · no location linked"}
                  </p>
                  {ev.notes ? <p className="mt-1 text-[11px] text-slate-400">{ev.notes}</p> : null}
                </button>
                <div className="mt-1 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 border-slate-500 bg-slate-700 px-2 text-[10px] text-slate-100"
                    onClick={() => {
                      setEditingEventId(ev.id);
                      setEditTitle(ev.title);
                      setEditTime(ev.occurredAt ? new Date(ev.occurredAt).toISOString().slice(0, 16) : "");
                      setEditMarkerId(ev.markerId ?? "none");
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 border-slate-500 bg-slate-700 px-2 text-[10px] text-slate-100"
                    onClick={() => setExpandedEventId((curr) => (curr === ev.id ? null : ev.id))}
                  >
                    {expandedEventId === ev.id ? "Hide evidence" : "Show evidence"}
                  </Button>
                </div>
                {expandedEventId === ev.id ? (
                  <div className="mt-2 space-y-1 rounded border border-slate-600/80 bg-slate-900/60 p-2">
                    {evidenceRows.length === 0 ? (
                      <p className="text-[11px] text-slate-400">No evidence linked to this timeline event yet.</p>
                    ) : (
                      evidenceRows.map((row) => (
                        <div key={row.id} className="flex items-center gap-2 text-[11px] text-slate-200">
                          <span className="min-w-0 flex-1 truncate">{row.label}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-6 border-rose-500/70 bg-rose-900/30 px-2 text-[10px] text-rose-100"
                            onClick={() => onUnlinkEvidence(ev.id, row.id)}
                          >
                            Unlink
                          </Button>
                          <Button asChild size="sm" variant="outline" className="h-6 border-slate-500 bg-slate-700 px-2 text-[10px]">
                            <Link href={row.href}>Open evidence</Link>
                          </Button>
                        </div>
                      ))
                    )}
                    {evidenceRows.length > 0 ? (
                      <div className="mt-1 flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 border-slate-500 bg-slate-700 px-2 text-[10px] text-slate-100"
                          onClick={() =>
                            dispatchWorkspaceAiAttachEvidence({
                              evidenceIds: evidenceRows.map((e) => e.id),
                              caseId: evidenceRows.find((e) => e.caseId)?.caseId ?? null,
                            })
                          }
                        >
                          <Send className="mr-1 h-3 w-3" />
                          Send to AI
                        </Button>
                        {evidenceRows.length === 2 ? (
                          <Button asChild size="sm" variant="outline" className="h-6 border-slate-500 bg-slate-700 px-2 text-[10px]">
                            <Link href={`/evidence/compare?a=${encodeURIComponent(evidenceRows[0]!.id)}&b=${encodeURIComponent(evidenceRows[1]!.id)}`}>
                              <SplitSquareHorizontal className="mr-1 h-3 w-3" />
                              Compare
                            </Link>
                          </Button>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

