import type { CaseIncidentEntry } from "@/lib/case-directory";
import { resolveCoord } from "@/lib/dashboard-location-utils";
import type { AppSupabaseClient } from "@/types";

/**
 * Keeps `case_incident_map_pins` in sync with incident entry location fields.
 * - One row per (case_id, incident_entry_id); upserts on save, deletes when location removed or incident dropped.
 * - Latitude/longitude are set only when `resolveCoord` can map city/state (curated list); otherwise left null (no fake coords).
 */
export async function syncCaseIncidentMapPins(
  supabase: AppSupabaseClient,
  caseId: string,
  entries: CaseIncidentEntry[],
): Promise<void> {
  const desired = entries.filter((e) => {
    const id = e.id?.trim();
    const city = e.city?.trim();
    const state = e.state?.trim();
    return Boolean(id && city && state);
  });

  const keepIds = desired.map((e) => e.id.trim());

  const { data: existing, error: exErr } = await supabase
    .from("case_incident_map_pins")
    .select("id, incident_entry_id")
    .eq("case_id", caseId);
  if (exErr) throw new Error(exErr.message);

  const toDelete = (existing ?? [])
    .filter((r) => !keepIds.includes(String(r.incident_entry_id)))
    .map((r) => r.id as string);
  if (toDelete.length > 0) {
    const { error: delErr } = await supabase.from("case_incident_map_pins").delete().in("id", toDelete);
    if (delErr) throw new Error(delErr.message);
  }

  if (desired.length === 0) return;

  const rows = desired.map((e) => {
    const city = e.city!.trim();
    const state = e.state!.trim();
    const addressLine1 = e.address_line_1?.trim() ?? "";
    const addressLine2 = e.address_line_2?.trim() ?? "";
    const coord = resolveCoord(city, state);
    const titlePart = e.incident_title?.trim() || "Incident";
    const label = `${titlePart} — ${city}, ${state}`;
    return {
      case_id: caseId,
      incident_entry_id: e.id.trim(),
      label,
      city,
      state,
      address_line: [addressLine1, addressLine2].filter(Boolean).join(", ") || null,
      latitude: coord?.lat ?? null,
      longitude: coord?.lon ?? null,
    };
  });

  const { error: upErr } = await supabase.from("case_incident_map_pins").upsert(rows, {
    onConflict: "case_id,incident_entry_id",
  });
  if (upErr) throw new Error(upErr.message);
}
