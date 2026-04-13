import type { AppSupabaseClient } from "@/types";

export type AnalystInteractionEvent = {
  id: string;
  created_at: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
};

/**
 * Alternate analyst-work timeline sourced from `activity_log`.
 * Keeps user interaction history separate from factual timeline tiers/kinds.
 */
export async function listAnalystInteractionTimeline(
  supabase: AppSupabaseClient,
  input: { caseId: string; actorId: string; limit?: number },
): Promise<AnalystInteractionEvent[]> {
  const lim = Math.min(Math.max(input.limit ?? 500, 1), 2000);
  const { data, error } = await supabase
    .from("activity_log")
    .select("id, created_at, action, entity_type, entity_id, payload")
    .eq("case_id", input.caseId)
    .eq("actor_id", input.actorId)
    .order("created_at", { ascending: false })
    .limit(lim);
  if (error) throw new Error(error.message);
  return ((data ?? []) as AnalystInteractionEvent[]).reverse();
}

