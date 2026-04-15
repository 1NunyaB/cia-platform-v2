import type {
  DashboardCaseLocation,
  DashboardEvidenceItem,
  DashboardMapMarker,
  DashboardMarkerKind,
  DashboardTimelineEvent,
} from "@/lib/dashboard-command-types";

const CITY_COORDS: Record<string, { lat: number; lon: number }> = {
  "new york": { lat: 40.7128, lon: -74.006 },
  london: { lat: 51.5072, lon: -0.1276 },
  paris: { lat: 48.8566, lon: 2.3522 },
  losangeles: { lat: 34.0522, lon: -118.2437 },
  chicago: { lat: 41.8781, lon: -87.6298 },
  houston: { lat: 29.7604, lon: -95.3698 },
  miami: { lat: 25.7617, lon: -80.1918 },
  atlanta: { lat: 33.749, lon: -84.388 },
  dallas: { lat: 32.7767, lon: -96.797 },
  seattle: { lat: 47.6062, lon: -122.3321 },
  tokyo: { lat: 35.6762, lon: 139.6503 },
  delhi: { lat: 28.6139, lon: 77.209 },
  mumbai: { lat: 19.076, lon: 72.8777 },
  beijing: { lat: 39.9042, lon: 116.4074 },
  sydney: { lat: -33.8688, lon: 151.2093 },
  moscow: { lat: 55.7558, lon: 37.6176 },
  cairo: { lat: 30.0444, lon: 31.2357 },
  nairobi: { lat: -1.2921, lon: 36.8219 },
  lagos: { lat: 6.5244, lon: 3.3792 },
  "sao paulo": { lat: -23.5558, lon: -46.6396 },
  "mexico city": { lat: 19.4326, lon: -99.1332 },
  toronto: { lat: 43.6532, lon: -79.3832 },
  berlin: { lat: 52.52, lon: 13.405 },
  madrid: { lat: 40.4168, lon: -3.7038 },
  rome: { lat: 41.9028, lon: 12.4964 },
  dubai: { lat: 25.2048, lon: 55.2708 },
  singapore: { lat: 1.3521, lon: 103.8198 },
  bangkok: { lat: 13.7563, lon: 100.5018 },
  istanbul: { lat: 41.0082, lon: 28.9784 },
  johannesburg: { lat: -26.2041, lon: 28.0473 },
};

const STATE_TO_CITY_FALLBACK: Record<string, string> = {
  texas: "dallas",
  california: "losangeles",
  florida: "miami",
  georgia: "atlanta",
  illinois: "chicago",
  washington: "seattle",
  newyork: "new york",
};

export function normalizeLocationToken(input: string | null | undefined): string {
  return String(input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function resolveCoord(city?: string | null, state?: string | null): { lat: number; lon: number } | null {
  const cityNorm = normalizeLocationToken(city);
  const stateNorm = normalizeLocationToken(state).replace(/\s/g, "");
  if (cityNorm && CITY_COORDS[cityNorm]) return CITY_COORDS[cityNorm]!;
  if (stateNorm && STATE_TO_CITY_FALLBACK[stateNorm]) {
    const fallbackCity = STATE_TO_CITY_FALLBACK[stateNorm]!;
    return CITY_COORDS[fallbackCity] ?? null;
  }
  return null;
}

function markerKindFromCase(caseId: string, activeCaseId: string | null): DashboardMarkerKind {
  return activeCaseId && caseId === activeCaseId ? "active" : "confirmed";
}

export function deriveDashboardMarkers(
  evidenceRows: DashboardEvidenceItem[],
  cases: DashboardCaseLocation[],
  activeCaseId: string | null,
): DashboardMapMarker[] {
  const evidenceByCase = new Map<string, string[]>();
  for (const row of evidenceRows) {
    if (!row.case_id) continue;
    const list = evidenceByCase.get(row.case_id) ?? [];
    list.push(row.id);
    evidenceByCase.set(row.case_id, list);
  }

  const grouped = new Map<string, DashboardMapMarker>();
  for (const c of cases) {
    const coord = resolveCoord(c.incident_city, c.incident_state);
    if (!coord) continue;
    const label = [c.incident_city?.trim(), c.incident_state?.trim()].filter(Boolean).join(", ") || c.title;
    const locationKey = normalizeLocationToken(label);
    const key = `loc:${locationKey}`;
    const kind = markerKindFromCase(c.id, activeCaseId);
    const existing = grouped.get(key);
    const evidenceIds = evidenceByCase.get(c.id) ?? [];
    if (!existing) {
      grouped.set(key, {
        id: key,
        label,
        lat: coord.lat,
        lon: coord.lon,
        kind,
        markerTypeLabel: "confirmed",
        locationKey,
        linkedEvidenceIds: [...evidenceIds],
        linkedCaseIds: [c.id],
      });
    } else {
      existing.linkedCaseIds.push(c.id);
      existing.linkedEvidenceIds = [...new Set([...existing.linkedEvidenceIds, ...evidenceIds])];
      if (kind === "active") existing.kind = "active";
    }
  }

  // Suspected markers from evidence source metadata.
  for (const row of evidenceRows) {
    const blob = normalizeLocationToken(`${row.source_platform ?? ""} ${row.source_program ?? ""} ${row.original_filename ?? ""}`);
    if (!blob) continue;
    for (const [city, coord] of Object.entries(CITY_COORDS)) {
      if (!blob.includes(city)) continue;
      const locationKey = normalizeLocationToken(city);
      const key = `sus:${locationKey}`;
      if (grouped.has(key)) continue;
      grouped.set(key, {
        id: key,
        label: `${city.replace(/\b\w/g, (m) => m.toUpperCase())} (suspected)`,
        lat: coord.lat,
        lon: coord.lon,
        kind: "suspected",
        markerTypeLabel: "possible",
        locationKey,
        linkedEvidenceIds: [row.id],
        linkedCaseIds: row.case_id ? [row.case_id] : [],
      });
    }
  }

  return [...grouped.values()].slice(0, 60);
}

export function deriveInitialTimelineEvents(markers: DashboardMapMarker[]): DashboardTimelineEvent[] {
  return markers.map((m, i) => ({
    id: `ev:${m.id}`,
    title: m.kind === "suspected" ? `Lead near ${m.label}` : `Event at ${m.label}`,
    whenLabel: "Approximate time window",
    approx: true,
    occurredAt: null,
    createdAtMs: Date.now() + i,
    locationKey: m.locationKey,
    markerId: m.id,
    linkedEvidenceIds: m.linkedEvidenceIds,
    linkedCaseIds: m.linkedCaseIds,
    notes: m.kind === "suspected" ? "Derived from evidence metadata; verify before confirming." : undefined,
  }));
}

