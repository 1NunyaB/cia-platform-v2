"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertPlatformDeleteAdmin } from "@/lib/admin-guard";
import { parseIncidentEntries } from "@/lib/case-directory";
import { logActivity } from "@/services/activity-service";
import { regenerateReconstructedTimeline } from "@/services/reconstructed-timeline-service";

export async function regenerateReconstructedTimelineAction(formData: FormData) {
  const caseId = formData.get("caseId");
  if (typeof caseId !== "string" || !caseId) {
    throw new Error("Missing case id");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  assertPlatformDeleteAdmin(user);

  await regenerateReconstructedTimeline(supabase, caseId);
  await logActivity(supabase, {
    action: "timeline_reconstructed.regenerated_admin",
    caseId,
    actorId: user.id,
    entityType: "case",
    entityId: caseId,
    payload: { destructive_reset: true },
  });
  revalidatePath(`/cases/${caseId}/timeline`);
}

type IncidentSelection = {
  incidentId: string;
  mode: "confirmed" | "theory" | "timeline_by_person";
  personName?: string | null;
};

function incidentOccurredAtIso(date: string | null, year: number | null): string | null {
  const d = date?.trim() ?? "";
  if (d) {
    const parsed = new Date(`${d}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }
  if (typeof year === "number" && Number.isFinite(year)) {
    return new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)).toISOString();
  }
  return null;
}

function modeToTimelineFields(sel: IncidentSelection): {
  timeline_tier: "t1_confirmed" | "t3_leads" | "t2_supported";
  timeline_kind: "official" | "custom";
  custom_lane_label: string | null;
} {
  if (sel.mode === "confirmed") {
    return { timeline_tier: "t1_confirmed", timeline_kind: "official", custom_lane_label: null };
  }
  if (sel.mode === "timeline_by_person") {
    const person = sel.personName?.trim() ?? "";
    return {
      timeline_tier: "t2_supported",
      timeline_kind: "custom",
      custom_lane_label: person ? `${person} Timeline` : "Person Timeline",
    };
  }
  return { timeline_tier: "t3_leads", timeline_kind: "custom", custom_lane_label: null };
}

export async function addIncidentsToTimelineAction(formData: FormData) {
  const caseId = formData.get("caseId");
  const selectionsRaw = formData.get("selections");
  if (typeof caseId !== "string" || !caseId) throw new Error("Missing case id");
  if (typeof selectionsRaw !== "string" || !selectionsRaw.trim()) throw new Error("Missing incident selections");

  let selections: IncidentSelection[] = [];
  try {
    const parsed = JSON.parse(selectionsRaw) as IncidentSelection[];
    selections = Array.isArray(parsed) ? parsed : [];
  } catch {
    throw new Error("Invalid incident selections payload");
  }
  if (selections.length === 0) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: caseRow, error: caseErr } = await supabase
    .from("cases")
    .select("id, incident_entries")
    .eq("id", caseId)
    .single();
  if (caseErr || !caseRow) throw new Error(caseErr?.message ?? "Case not found");

  const entries = parseIncidentEntries((caseRow as { incident_entries?: unknown }).incident_entries);
  const byId = new Map(entries.map((x) => [x.id, x] as const));

  const sourceLabels = selections.map((s) => `Incident:${s.incidentId}`);
  const { data: existingRows } = await supabase
    .from("timeline_events")
    .select("id, source_label")
    .eq("case_id", caseId)
    .in("source_label", sourceLabels);
  const existingBySource = new Map(
    (existingRows ?? [])
      .filter((r) => typeof r.source_label === "string")
      .map((r) => [r.source_label as string, r.id as string] as const),
  );

  for (const sel of selections) {
    const entry = byId.get(sel.incidentId);
    if (!entry) continue;
    const source_label = `Incident:${entry.id}`;
    const occurred_at = incidentOccurredAtIso(entry.date ?? null, entry.year ?? null);
    const { timeline_tier, timeline_kind, custom_lane_label } = modeToTimelineFields(sel);
    const title =
      entry.incident_title.trim() ||
      entry.description.trim().slice(0, 120) ||
      "Incident";
    const summaryParts: string[] = [];
    if (entry.description.trim()) summaryParts.push(entry.description.trim());
    if (entry.city?.trim() || entry.state?.trim()) {
      summaryParts.push([entry.city?.trim() ?? "", entry.state?.trim() ?? ""].filter(Boolean).join(", "));
    }
    if (!entry.date && entry.year != null) summaryParts.push(`Approximate year: ${entry.year}`);
    const summary = summaryParts.join("\n\n").trim() || null;

    const existingId = existingBySource.get(source_label);
    if (existingId) {
      const { error: updErr } = await supabase
        .from("timeline_events")
        .update({
          title,
          summary,
          occurred_at,
          timeline_tier,
          timeline_kind,
          custom_lane_label,
          source_label,
        })
        .eq("id", existingId)
        .eq("case_id", caseId);
      if (updErr) throw new Error(updErr.message);
    } else {
      const { error: insErr } = await supabase.from("timeline_events").insert({
        case_id: caseId,
        evidence_file_id: null,
        ai_analysis_id: null,
        occurred_at,
        title,
        summary,
        timeline_tier,
        timeline_kind,
        custom_lane_label,
        source_label,
        event_classification: sel.mode === "confirmed" ? "Confirmed" : sel.mode === "theory" ? "Theory" : "Timeline by Person",
      });
      if (insErr) throw new Error(insErr.message);
    }
  }

  await logActivity(supabase, {
    action: "timeline.incidents_added",
    caseId,
    actorId: user.id,
    entityType: "case",
    entityId: caseId,
    payload: { count: selections.length },
  });
  revalidatePath(`/cases/${caseId}/timeline`);
}

export async function setTimelineEventWorkflowAction(formData: FormData) {
  const caseId = formData.get("caseId");
  const eventId = formData.get("eventId");
  const mode = formData.get("mode");
  const personName = formData.get("personName");
  if (typeof caseId !== "string" || !caseId) throw new Error("Missing case id");
  if (typeof eventId !== "string" || !eventId) throw new Error("Missing event id");
  if (mode !== "confirmed" && mode !== "theory" && mode !== "timeline_by_person") {
    throw new Error("Invalid workflow mode");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const base =
    mode === "confirmed"
      ? {
          timeline_tier: "t1_confirmed" as const,
          timeline_kind: "official" as const,
          custom_lane_label: null,
          event_classification: "Confirmed",
        }
      : mode === "theory"
        ? {
            timeline_tier: "t3_leads" as const,
            timeline_kind: "custom" as const,
            custom_lane_label: null,
            event_classification: "Theory",
          }
        : {
            timeline_tier: "t2_supported" as const,
            timeline_kind: "custom" as const,
            custom_lane_label:
              typeof personName === "string" && personName.trim()
                ? `${personName.trim()} Timeline`
                : "Person Timeline",
            event_classification: "Timeline by Person",
          };

  const { error } = await supabase
    .from("timeline_events")
    .update(base)
    .eq("id", eventId)
    .eq("case_id", caseId);
  if (error) throw new Error(error.message);

  await logActivity(supabase, {
    action: "timeline.event_workflow_set",
    caseId,
    actorId: user.id,
    entityType: "timeline_event",
    entityId: eventId,
    payload: { mode, personName: typeof personName === "string" ? personName : null },
  });

  revalidatePath(`/cases/${caseId}/timeline`);
}
