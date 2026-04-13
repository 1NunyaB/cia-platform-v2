import { tryCreateServiceClient } from "@/lib/supabase/service";

/**
 * Server-side usage logging (authenticated user id XOR guest_session_id).
 * Inserts via service role only — not exposed to browser clients.
 */
export async function logUsageEvent(input: {
  userId?: string | null;
  guestSessionId?: string | null;
  action: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const uid = input.userId?.trim() || null;
  const gid = input.guestSessionId?.trim() || null;
  if (!uid && !gid) return;
  if (uid && gid) return;

  const supabase = tryCreateServiceClient();
  if (!supabase) return;
  const { error } = await supabase.from("usage_events").insert({
    user_id: uid,
    guest_session_id: gid,
    action: input.action,
    meta: input.meta ?? {},
  });
  if (error) {
    console.warn("[usage_events]", error.message);
  }
}
