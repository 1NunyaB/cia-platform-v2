import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceClient } from "@/lib/supabase/service";
import { getGuestSessionIdFromCookies } from "@/lib/guest-session";
import { guestSessionExists } from "@/services/guest-session-service";
import type { AppSupabaseClient } from "@/types";

export type RequestActor =
  | { mode: "user"; userId: string; supabase: AppSupabaseClient }
  | { mode: "guest"; guestSessionId: string; service: AppSupabaseClient };

/**
 * Resolves signed-in user (Supabase session) or valid guest cookie + DB row.
 * Returns null if neither — caller should respond 401.
 */
export async function resolveRequestActor(): Promise<RequestActor | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    return { mode: "user", userId: user.id, supabase };
  }

  const service = tryCreateServiceClient();
  if (!service) return null;

  const guestSessionId = await getGuestSessionIdFromCookies();
  if (!guestSessionId) return null;

  const ok = await guestSessionExists(service, guestSessionId);
  if (!ok) return null;

  return { mode: "guest", guestSessionId, service };
}
