import type { AppSupabaseClient } from "@/types";

const DEFAULT_LABEL = "Analyst";

/**
 * Inserts activity_log rows without requiring a profiles FK on actor_id.
 * When actorId is missing or has no profile row, stores actor_id null and actor_label for display.
 */
export async function logActivity(
  supabase: AppSupabaseClient,
  input: {
    /** Null for library-only events (no case). */
    caseId: string | null;
    actorId?: string | null;
    /** Shown when actor_id is null or when the id has no profile (e.g. "System", "Analyst"). */
    actorLabel?: string | null;
    action: string;
    entityType?: string | null;
    entityId?: string | null;
    payload?: Record<string, unknown>;
  },
) {
  const fallbackLabel = (input.actorLabel?.trim() || DEFAULT_LABEL) as string;

  let actor_id: string | null = null;
  let actor_label: string | null = null;

  const rawId = input.actorId?.trim() || null;
  if (rawId) {
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", rawId)
      .maybeSingle();
    if (pErr) {
      console.warn("[activity] profile lookup failed:", pErr.message);
      actor_id = null;
      actor_label = fallbackLabel;
    } else if (profile) {
      actor_id = rawId;
      actor_label = null;
    } else {
      actor_id = null;
      actor_label = fallbackLabel;
    }
  } else {
    actor_id = null;
    actor_label = fallbackLabel;
  }

  const { error } = await supabase.from("activity_log").insert({
    case_id: input.caseId ?? null,
    actor_id,
    actor_label,
    action: input.action,
    entity_type: input.entityType ?? null,
    entity_id: input.entityId ?? null,
    payload: input.payload ?? {},
  });
  if (error) throw new Error(error.message);
}
