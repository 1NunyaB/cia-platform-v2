import { createClient } from "@/lib/supabase/server";
import {
  caseDirectoryPayloadSchema,
  deriveLegacyFromDirectory,
  flattenIncidentEntries,
  legacyArraysFromPeople,
  normalizeCaseDirectoryPayload,
  type CaseIncidentEntry,
} from "@/lib/case-directory";
import { isBlankOrValidMonthYear } from "@/lib/case-month-year";
import { syncCaseIncidentMapPins } from "@/services/case-incident-map-pins-service";
import { syncCaseIncidentTimelineEvents } from "@/services/case-incident-timeline-service";
import { clearEvidenceIncidentLinksNotInCaseSet } from "@/services/evidence-service";
import { NextResponse } from "next/server";
import { z } from "zod";

function withDefaultNestedArrays(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.incident_entries)) return raw;
  return {
    ...body,
    incident_entries: body.incident_entries.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const e = entry as Record<string, unknown>;
      return {
        ...e,
        people: Array.isArray(e.people) ? e.people : [],
        legal_milestones: Array.isArray(e.legal_milestones) ? e.legal_milestones : [],
        evidence_items: Array.isArray(e.evidence_items) ? e.evidence_items : [],
      };
    }),
  };
}

function trimToNull(s: string | null | undefined): string | null {
  if (s == null) return null;
  const t = s.trim();
  return t || null;
}

const patchSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().max(10000).nullable().optional(),
  })
  .merge(caseDirectoryPayloadSchema.partial())
  .superRefine((data, ctx) => {
    const entries = data.incident_entries;
    if (!entries) return;
    for (let ei = 0; ei < entries.length; ei++) {
      const entry = entries[ei];
      for (let mi = 0; mi < entry.legal_milestones.length; mi++) {
        const my = entry.legal_milestones[mi]?.month_year?.trim() ?? "";
        if (my && !isBlankOrValidMonthYear(my)) {
          ctx.addIssue({
            code: "custom",
            message: "Each legal action needs a valid month/year.",
            path: ["incident_entries", ei, "legal_milestones", mi, "month_year"],
          });
        }
      }
    }
  });

export async function PATCH(request: Request, { params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(withDefaultNestedArrays(json));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const raw = parsed.data;
  if (Object.keys(raw).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: before, error: beforeErr } = await supabase.from("cases").select("id").eq("id", caseId).maybeSingle();
  if (beforeErr || !before) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const update: Record<string, unknown> = {};
  let incidentEntriesForPins: CaseIncidentEntry[] | null = null;

  if (raw.title !== undefined) update.title = raw.title.trim();
  if (raw.description !== undefined) update.description = trimToNull(raw.description);

  if (raw.incident_entries !== undefined) {
    const norm = normalizeCaseDirectoryPayload({
      incident_entries: raw.incident_entries,
    });
    incidentEntriesForPins = norm.incident_entries;
    const flat = flattenIncidentEntries(norm.incident_entries);
    const legacy = deriveLegacyFromDirectory(norm);
    const { case_victims, case_accused } = legacyArraysFromPeople(flat.people);

    update.incident_entries = norm.incident_entries;
    update.incidents = flat.incidents;
    update.case_people = flat.people;
    update.case_victims = case_victims;
    update.case_accused = case_accused;
    update.legal_milestones = flat.legal_milestones;
    update.evidence_file_entries = flat.evidence_file_entries;
    update.charges = trimToNull(flat.charges || undefined);
    update.incident_year = legacy.incident_year;
    update.incident_city = legacy.incident_city;
    update.incident_state = legacy.incident_state;
    update.accused_label = legacy.accused_label;
    update.victim_labels = legacy.victim_labels;
    update.indictment_month_year = legacy.indictment_month_year;
    update.conviction_month_year = legacy.conviction_month_year;
    update.sentence = legacy.sentence;
  }

  const { data: updated, error: upErr } = await supabase
    .from("cases")
    .update(update)
    .eq("id", caseId)
    .select("*")
    .maybeSingle();

  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  if (incidentEntriesForPins) {
    try {
      await syncCaseIncidentTimelineEvents(supabase, caseId, incidentEntriesForPins);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Timeline sync failed";
      console.error("[case-incident-timeline] sync after patch failed:", message);
      return NextResponse.json(
        {
          error:
            "Incident was saved, but syncing the standard timeline failed. Please retry or refresh the timeline.",
          detail: message,
        },
        { status: 500 },
      );
    }
    try {
      await syncCaseIncidentMapPins(supabase, caseId, incidentEntriesForPins);
    } catch (e) {
      console.warn("[case-incident-map-pins] sync after patch failed:", e instanceof Error ? e.message : e);
    }
    try {
      const valid = new Set(
        incidentEntriesForPins.map((e) => e.id?.trim() ?? "").filter((id) => id.length > 0),
      );
      await clearEvidenceIncidentLinksNotInCaseSet(supabase, caseId, valid);
    } catch (e) {
      console.warn("[evidence] clear stale incident_entry_id after patch failed:", e instanceof Error ? e.message : e);
    }
  }

  return NextResponse.json({ case: updated });
}
