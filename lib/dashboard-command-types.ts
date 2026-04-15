export type DashboardEvidenceItem = {
  id: string;
  case_id: string | null;
  original_filename: string;
  source_platform?: string | null;
  source_program?: string | null;
};

export type DashboardCaseLocation = {
  id: string;
  title: string;
  incident_city?: string | null;
  incident_state?: string | null;
};

export type DashboardMarkerKind = "confirmed" | "suspected" | "active" | "user";

export type DashboardMapMarker = {
  id: string;
  label: string;
  lat: number;
  lon: number;
  kind: DashboardMarkerKind;
  markerTypeLabel?: "confirmed" | "possible" | "user-added";
  locationKey: string;
  linkedTimelineEventIds?: string[];
  linkedEvidenceIds: string[];
  linkedCaseIds: string[];
};

export type DashboardTimelineEvent = {
  id: string;
  title: string;
  whenLabel: string;
  approx: boolean;
  occurredAt?: string | null;
  createdAtMs?: number;
  locationKey: string | null;
  markerId: string | null;
  linkedEvidenceIds: string[];
  linkedCaseIds: string[];
  notes?: string;
};

