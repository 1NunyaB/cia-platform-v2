import type { AppSupabaseClient } from "@/types";
import type { TimelineTier } from "@/types/analysis";

export type TheoryPlacementRow = {
  timeline_event_id: string;
  provisional_occurred_at: string;
  revision_history: unknown;
  updated_at: string;
};

/**
 * Load hypothesis placements for the current user (Theory mode display only).
 */
export async function listTheoryPlacementsForUser(
  supabase: AppSupabaseClient,
  caseId: string,
  userId: string,
): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("timeline_theory_placements")
    .select("timeline_event_id, provisional_occurred_at")
    .eq("case_id", caseId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
  const map = new Map<string, string>();
  for (const row of data ?? []) {
    map.set(row.timeline_event_id as string, row.provisional_occurred_at as string);
  }
  return map;
}

type RevisionEntry = { at: string; from: string | null; to: string };

/**
 * Save or update a provisional time for Theory mode. Timeline 1 (confirmed) events are rejected.
 */
export async function upsertTheoryPlacement(
  supabase: AppSupabaseClient,
  input: {
    caseId: string;
    userId: string;
    timelineEventId: string;
    provisionalOccurredAt: string;
  },
): Promise<void> {
  const { data: ev, error: evErr } = await supabase
    .from("timeline_events")
    .select("id, case_id, timeline_tier")
    .eq("id", input.timelineEventId)
    .single();

  if (evErr || !ev) throw new Error(evErr?.message ?? "Event not found");
  if ((ev.case_id as string) !== input.caseId) throw new Error("Event does not belong to this case");

  const tier = ev.timeline_tier as TimelineTier | null;
  if (tier === "t1_confirmed") {
    throw new Error("Confirmed (Timeline 1) events cannot be repositioned in Theory mode.");
  }

  const { data: existing } = await supabase
    .from("timeline_theory_placements")
    .select("id, provisional_occurred_at, revision_history")
    .eq("timeline_event_id", input.timelineEventId)
    .eq("user_id", input.userId)
    .maybeSingle();

  const prev = (existing?.provisional_occurred_at as string | undefined) ?? null;
  const history = Array.isArray(existing?.revision_history)
    ? [...(existing!.revision_history as RevisionEntry[])]
    : [];
  history.push({
    at: new Date().toISOString(),
    from: prev,
    to: input.provisionalOccurredAt,
  });

  const payload = {
    provisional_occurred_at: input.provisionalOccurredAt,
    revision_history: history.slice(-50),
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("timeline_theory_placements")
      .update(payload)
      .eq("id", existing.id as string);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("timeline_theory_placements").insert({
      case_id: input.caseId,
      timeline_event_id: input.timelineEventId,
      user_id: input.userId,
      ...payload,
    });
    if (error) throw new Error(error.message);
  }
}

export async function clearTheoryPlacement(
  supabase: AppSupabaseClient,
  input: { caseId: string; userId: string; timelineEventId: string },
): Promise<void> {
  const { error } = await supabase
    .from("timeline_theory_placements")
    .delete()
    .eq("case_id", input.caseId)
    .eq("user_id", input.userId)
    .eq("timeline_event_id", input.timelineEventId);

  if (error) throw new Error(error.message);
}
