import type { CaseIncidentEntry } from "@/lib/case-directory";
import { isBlankOrValidMonthYear } from "@/lib/case-month-year";
import type { AppSupabaseClient } from "@/types";

type TimelineIncidentEventRow = {
  id: string;
  source_label: string | null;
};

function sourceLabelForIncident(incidentId: string): string {
  return `Incident:${incidentId}`;
}

function parseMonthYearToIso(monthYear: string): string | null {
  const t = monthYear.trim();
  if (!t || !isBlankOrValidMonthYear(t)) return null;
  const m = t.match(/^(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const month = Number.parseInt(m[1], 10);
  const year = Number.parseInt(m[2], 10);
  if (!Number.isFinite(month) || !Number.isFinite(year)) return null;
  return new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)).toISOString();
}

function occurredAtFromIncident(entry: CaseIncidentEntry): string | null {
  const d = entry.date?.trim() ?? "";
  if (d) {
    const parsed = new Date(`${d}T00:00:00.000Z`);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  const firstMilestoneMonthYear = entry.legal_milestones.find((m) => m.month_year?.trim())?.month_year ?? "";
  const monthYearIso = parseMonthYearToIso(firstMilestoneMonthYear);
  if (monthYearIso) return monthYearIso;
  if (typeof entry.year === "number" && Number.isFinite(entry.year)) {
    return new Date(Date.UTC(entry.year, 0, 1, 0, 0, 0, 0)).toISOString();
  }
  return null;
}

function timelineTitle(entry: CaseIncidentEntry): string {
  const title = entry.incident_title.trim();
  if (title) return title;
  const desc = entry.description.trim();
  if (desc) return desc.slice(0, 120);
  return "Incident";
}

function timelineSummary(entry: CaseIncidentEntry): string | null {
  const parts: string[] = [];
  const description = entry.description.trim();
  if (description) parts.push(description);
  const location = [entry.address_line_1, entry.address_line_2, entry.city, entry.state]
    .map((x) => x?.trim() ?? "")
    .filter(Boolean)
    .join(", ");
  if (location) parts.push(`Location: ${location}`);
  if (!entry.date && entry.year != null) parts.push(`Approximate year: ${entry.year}`);
  const joined = parts.join("\n\n").trim();
  return joined || null;
}

export async function syncCaseIncidentTimelineEvents(
  supabase: AppSupabaseClient,
  caseId: string,
  entries: CaseIncidentEntry[],
): Promise<void> {
  const validEntries = entries.filter((e) => typeof e.id === "string" && e.id.trim().length > 0);
  const wantedLabels = new Set(validEntries.map((e) => sourceLabelForIncident(e.id.trim())));

  const { data: existingRows, error: existingErr } = await supabase
    .from("timeline_events")
    .select("id, source_label")
    .eq("case_id", caseId)
    .like("source_label", "Incident:%");
  if (existingErr) throw new Error(existingErr.message);

  const existingByLabel = new Map<string, TimelineIncidentEventRow[]>();
  for (const row of (existingRows ?? []) as TimelineIncidentEventRow[]) {
    const label = typeof row.source_label === "string" ? row.source_label : "";
    if (!label) continue;
    const list = existingByLabel.get(label) ?? [];
    list.push(row);
    existingByLabel.set(label, list);
  }

  const staleIds = ((existingRows ?? []) as TimelineIncidentEventRow[])
    .filter((row) => {
      const label = typeof row.source_label === "string" ? row.source_label : "";
      return label.startsWith("Incident:") && !wantedLabels.has(label);
    })
    .map((row) => row.id);
  if (staleIds.length > 0) {
    const { error: delErr } = await supabase.from("timeline_events").delete().in("id", staleIds).eq("case_id", caseId);
    if (delErr) throw new Error(delErr.message);
  }

  for (const entry of validEntries) {
    const incidentId = entry.id.trim();
    const source_label = sourceLabelForIncident(incidentId);
    const payload = {
      case_id: caseId,
      evidence_file_id: null,
      ai_analysis_id: null,
      occurred_at: occurredAtFromIncident(entry),
      title: timelineTitle(entry),
      summary: timelineSummary(entry),
      timeline_tier: "t2_supported" as const,
      timeline_kind: "evidence" as const,
      custom_lane_label: null,
      source_label,
      event_classification: "Incident",
    };

    const existing = existingByLabel.get(source_label) ?? [];
    if (existing.length > 0) {
      const keep = existing[0]!;
      const { error: updErr } = await supabase
        .from("timeline_events")
        .update(payload)
        .eq("id", keep.id)
        .eq("case_id", caseId);
      if (updErr) throw new Error(updErr.message);
      const duplicateIds = existing.slice(1).map((r) => r.id);
      if (duplicateIds.length > 0) {
        const { error: dupDelErr } = await supabase
          .from("timeline_events")
          .delete()
          .in("id", duplicateIds)
          .eq("case_id", caseId);
        if (dupDelErr) throw new Error(dupDelErr.message);
      }
      continue;
    }

    const { error: insErr } = await supabase.from("timeline_events").insert(payload);
    if (insErr) throw new Error(insErr.message);
  }
}
