import type { AppSupabaseClient } from "@/types";

export async function insertGuestSession(
  supabase: AppSupabaseClient,
  input: { ipAddress: string | null; userAgent: string | null },
): Promise<string> {
  const { data, error } = await supabase
    .from("guest_sessions")
    .insert({
      ip_address: input.ipAddress,
      user_agent: input.userAgent,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data!.id as string;
}

export async function touchGuestSession(supabase: AppSupabaseClient, guestSessionId: string): Promise<void> {
  const { error } = await supabase
    .from("guest_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", guestSessionId);
  if (error) console.warn("[guest_sessions] touch failed:", error.message);
}

export async function guestSessionExists(supabase: AppSupabaseClient, guestSessionId: string): Promise<boolean> {
  const { data, error } = await supabase.from("guest_sessions").select("id").eq("id", guestSessionId).maybeSingle();
  if (error) return false;
  return data != null;
}
