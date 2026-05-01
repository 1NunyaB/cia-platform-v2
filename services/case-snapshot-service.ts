import { caseDirectorySearchBlob } from "@/lib/case-directory";
import type { AppSupabaseClient, CaseRow } from "@/types";
import { getCaseIndexSnapshot } from "@/services/case-index-service";

export type CaseSnapshot = {
  case_id: string;
  title: string;
  description: string;
  created_at: string;
  evidence_ids: string[];
  event_ids: string[];
  location_ids: string[];
  tags: string[];
  status: "created" | "not_started" | "active" | "on_hold";
};

function deriveStatus(caseRow: {
  investigation_started_at?: string | null;
  investigation_on_hold_at?: string | null;
}): CaseSnapshot["status"] {
  if (caseRow.investigation_on_hold_at) return "on_hold";
  if (caseRow.investigation_started_at) return "active";
  return "not_started";
}

function deriveTags(input: {
  evidenceCount: number;
  eventCount: number;
  locationCount: number;
  hasFinancialHint: boolean;
}): string[] {
  const tags: string[] = [];
  if (input.hasFinancialHint) tags.push("financial");
  if (input.eventCount >= Math.max(3, Math.ceil(input.evidenceCount * 0.5))) tags.push("timeline-heavy");
  if (input.locationCount > 0) tags.push("geo-linked");
  if (input.evidenceCount >= 10) tags.push("evidence-dense");
  return tags;
}

export async function buildCaseSnapshot(
  supabase: AppSupabaseClient,
  caseId: string,
): Promise<CaseSnapshot | null> {
  const { data: caseRow, error } = await supabase
    .from("cases")
    .select(
      "id, title, description, created_at, charges, indictment_month_year, conviction_month_year, sentence, incident_entries, incidents, case_people, case_victims, case_accused, legal_milestones, evidence_file_entries, accused_label, victim_labels, incident_city, incident_state, incident_year, investigation_started_at, investigation_on_hold_at",
    )
    .eq("id", caseId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!caseRow) return null;

  const snap = await getCaseIndexSnapshot(supabase, caseId);
  const evidence_ids = snap.evidenceItems.map((item) => item.evidenceId);
  const event_ids = snap.events.map((event) => event.id);
  const location_ids = snap.locations.map((loc) => loc.entityId);

  const textHaystack = caseDirectorySearchBlob(caseRow as CaseRow).toLowerCase().trim();
  const hasFinancialHint = /bank|wire|transfer|invoice|ledger|account|payment|fraud|financial|money/.test(
    textHaystack,
  );

  return {
    case_id: String(caseRow.id),
    title: String(caseRow.title ?? ""),
    description: String(caseRow.description ?? ""),
    created_at: String(caseRow.created_at ?? ""),
    evidence_ids,
    event_ids,
    location_ids,
    tags: deriveTags({
      evidenceCount: evidence_ids.length,
      eventCount: event_ids.length,
      locationCount: location_ids.length,
      hasFinancialHint,
    }),
    status: deriveStatus(caseRow),
  };
}

