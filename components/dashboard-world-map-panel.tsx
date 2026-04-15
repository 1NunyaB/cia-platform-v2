"use client";

import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, Plus } from "lucide-react";
import type { DashboardMapMarker, DashboardMarkerKind } from "@/lib/dashboard-command-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

type AddMarkerDraft = {
  lng: number;
  lat: number;
  name: string;
  type: "event" | "sighting" | "unknown";
};

function markerClass(kind: DashboardMarkerKind): string {
  if (kind === "active") return "bg-red-400 border-red-100";
  if (kind === "confirmed") return "bg-red-400 border-red-100";
  if (kind === "suspected") return "bg-yellow-300 border-yellow-50";
  return "bg-sky-300 border-sky-50";
}

function markerGlow(kind: DashboardMarkerKind): string {
  if (kind === "active") return "0 0 16px rgba(248,113,113,0.95)";
  if (kind === "confirmed") return "0 0 14px rgba(248,113,113,0.95)";
  if (kind === "suspected") return "0 0 14px rgba(253,224,71,0.9)";
  return "0 0 14px rgba(125,211,252,0.9)";
}

export function DashboardWorldMapPanel({
  className,
  markers,
  evidenceLookup,
  activeMarkerId,
  filteredLocationKey,
  timelineCountByMarkerId,
  onSelectMarker,
  onClearSelection,
  onAddUserMarker,
  onUnlinkEvidence,
}: {
  className?: string;
  markers: DashboardMapMarker[];
  evidenceLookup: Map<string, { id: string; label: string; href: string }>;
  activeMarkerId: string | null;
  filteredLocationKey: string | null;
  timelineCountByMarkerId: Record<string, number>;
  onSelectMarker: (markerId: string | null) => void;
  onClearSelection: () => void;
  onAddUserMarker: (draft: { lng: number; lat: number; name: string; type: "event" | "sighting" | "unknown" }) => void;
  onUnlinkEvidence: (markerId: string, evidenceId: string) => void;
}) {
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markerRefs = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const [draft, setDraft] = useState<AddMarkerDraft | null>(null);
  const token = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "";

  const markerById = useMemo(() => new Map(markers.map((m) => [m.id, m])), [markers]);
  const activeMarker = activeMarkerId ? markerById.get(activeMarkerId) ?? null : null;

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    if (!token) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: [8, 20],
      zoom: 1.35,
      projection: "mercator",
      attributionControl: false,
    });
    mapRef.current = map;

    map.on("click", (ev) => {
      setDraft({
        lng: Number(ev.lngLat.lng.toFixed(5)),
        lat: Number(ev.lngLat.lat.toFixed(5)),
        name: "",
        type: "unknown",
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRefs.current.clear();
    };
  }, [token]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    for (const [id, marker] of markerRefs.current.entries()) {
      if (!markerById.has(id)) {
        marker.remove();
        markerRefs.current.delete(id);
      }
    }
    for (const m of markers) {
      let marker = markerRefs.current.get(m.id);
      if (!marker) {
        const el = document.createElement("button");
        el.type = "button";
        el.className = `h-3.5 w-3.5 rounded-full border ${markerClass(m.kind)} transition-transform`;
        el.style.boxShadow = markerGlow(m.kind);
        el.title = `${m.label} • evidence ${m.linkedEvidenceIds.length} • cases ${m.linkedCaseIds.length}`;
        el.onclick = () => onSelectMarker(m.id);
        marker = new mapboxgl.Marker({ element: el }).setLngLat([m.lon, m.lat]).addTo(map);
        markerRefs.current.set(m.id, marker);
      } else {
        marker.setLngLat([m.lon, m.lat]);
      }
      const el = marker.getElement() as HTMLButtonElement;
      const dimmed = filteredLocationKey && m.locationKey !== filteredLocationKey;
      el.className = `h-3.5 w-3.5 rounded-full border ${markerClass(m.kind)} transition-transform ${
        activeMarkerId === m.id ? "scale-125 ring-2 ring-sky-300" : "scale-100"
      }`;
      el.style.boxShadow = markerGlow(m.kind);
      el.style.opacity = dimmed ? "0.35" : "1";
    }
  }, [activeMarkerId, filteredLocationKey, markerById, markers, onSelectMarker]);

  useEffect(() => {
    if (!activeMarker || !mapRef.current) return;
    mapRef.current.easeTo({
      center: [activeMarker.lon, activeMarker.lat],
      duration: 520,
      zoom: Math.max(3, mapRef.current.getZoom()),
    });
  }, [activeMarker]);

  if (!token) {
    return (
      <section
        className={cn(
          "p-2.5 text-slate-100",
          className ?? "rounded-lg border border-sky-400/15 bg-gradient-to-br from-[#1c2838] via-[#1a2535] to-[#141d2b]",
        )}
      >
        <p className="text-xs font-semibold text-slate-200">Locations map</p>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          Map is off. Add{" "}
          <code className="rounded border border-slate-600/80 bg-slate-950/80 px-1 py-0.5 text-slate-200">
            NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN
          </code>{" "}
          to enable live markers.
        </p>
      </section>
    );
  }

  return (
    <section
      className={cn(
        "p-2.5 text-slate-100",
        className ?? "rounded-lg border border-sky-400/15 bg-gradient-to-br from-[#1c2838] via-[#1a2535] to-[#141d2b]",
      )}
    >
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-200">Locations</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 border-slate-500 bg-slate-700 text-slate-100"
          onClick={onClearSelection}
        >
          Clear filter
        </Button>
      </div>
      <div
        ref={containerRef}
        className="h-[min(42vh,400px)] min-h-[220px] overflow-hidden rounded-md border border-slate-500/40 shadow-[inset_0_0_0_1px_rgba(125,211,252,0.04)]"
      />

      {draft ? (
        <div className="mt-2 rounded-md border border-slate-500/70 bg-slate-800/85 p-2">
          <p className="mb-2 text-xs font-semibold text-slate-100">Add location pin</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="loc-name" className="text-[11px] text-slate-200">
                Name
              </Label>
              <Input
                id="loc-name"
                value={draft.name}
                onChange={(e) => setDraft((prev) => (prev ? { ...prev, name: e.target.value } : prev))}
                placeholder="Location label"
                className="h-8 border-slate-500 bg-slate-900 text-slate-100"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-200">Type</Label>
              <Select
                value={draft.type}
                onValueChange={(v) =>
                  setDraft((prev) => (prev ? { ...prev, type: v as "event" | "sighting" | "unknown" } : prev))
                }
              >
                <SelectTrigger className="h-8 border-slate-500 bg-slate-900 text-slate-100">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="event">Event</SelectItem>
                  <SelectItem value="sighting">Sighting</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="mt-2 text-[11px] text-slate-300">
            {draft.lat.toFixed(4)}, {draft.lng.toFixed(4)}
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              type="button"
              size="sm"
              className="h-8 bg-sky-600 text-white hover:bg-sky-500"
              onClick={() => {
                if (!draft.name.trim()) return;
                onAddUserMarker(draft);
                setDraft(null);
              }}
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Add pin
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 border-slate-500 bg-slate-700 text-slate-100"
              onClick={() => setDraft(null)}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-2 rounded border border-slate-600/70 bg-slate-800/80 px-2 py-1.5 text-[11px] text-slate-200">
        {activeMarker ? (
          <div className="space-y-0.5">
            <p>
              <MapPin className="mr-1 inline h-3 w-3 text-sky-300" />
              {activeMarker.label}
            </p>
            <p>
              Type: {activeMarker.markerTypeLabel ?? (activeMarker.kind === "suspected" ? "possible" : "confirmed")}
            </p>
            <p>Linked timeline events: {timelineCountByMarkerId[activeMarker.id] ?? 0}</p>
            <p>Linked evidence: {activeMarker.linkedEvidenceIds.length}</p>
            {activeMarker.linkedEvidenceIds.length === 0 ? (
              <p className="text-[10px] text-slate-400">Link evidence from the list with “Add to map location”.</p>
            ) : null}
            {activeMarker.linkedEvidenceIds.length > 0 ? (
              <div className="mt-1 space-y-1 rounded border border-slate-600/80 bg-slate-900/60 p-1.5">
                {activeMarker.linkedEvidenceIds.slice(0, 4).map((id) => {
                  const row = evidenceLookup.get(id);
                  if (!row) return null;
                  return (
                    <div key={id} className="flex items-center gap-1.5">
                      <span className="min-w-0 flex-1 truncate text-[10px] text-slate-200">{row.label}</span>
                      <button
                        type="button"
                        className="text-[10px] font-medium text-rose-300 underline underline-offset-2"
                        onClick={() => onUnlinkEvidence(activeMarker.id, id)}
                      >
                        Unlink
                      </button>
                      <Link href={row.href} className="text-[10px] font-medium text-sky-300 underline underline-offset-2">
                        Open
                      </Link>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : markers.length ? (
          <p className="text-slate-400">Select a marker for details.</p>
        ) : (
          <p className="text-slate-400">Click the map to drop a pin.</p>
        )}
      </div>
    </section>
  );
}

