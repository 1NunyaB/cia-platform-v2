import type { AppSupabaseClient } from "@/types";

const RAPID_WINDOW_MS = 3000;
const COOLDOWN_MS = 30_000;
export const DASHBOARD_CHAT_MAX_LEN = 2000;

export type DashboardChatRateOk = { allowed: true; newBurst: number; trimmed: string };
export type DashboardChatRateDeny = { allowed: false; message: string };
export type DashboardChatRateResult = DashboardChatRateOk | DashboardChatRateDeny;

/**
 * Basic automated moderation (in addition to rate limits below).
 */
export function moderateDashboardChatContent(body: string): { ok: true; trimmed: string } | { ok: false; message: string } {
  const trimmed = body.trim();
  if (!trimmed) {
    return { ok: false, message: "Message cannot be empty." };
  }
  if (/^(.)\1{30,}$/m.test(trimmed)) {
    return { ok: false, message: "Message looks like spam (repeated characters)." };
  }
  const letters = trimmed.replace(/[\s\d\W]/g, "").length;
  if (trimmed.length > 12 && letters < 2) {
    return { ok: false, message: "Add a bit more readable text (not only symbols or numbers)." };
  }
  const urlCount = (trimmed.match(/https?:\/\/\S+/gi) ?? []).length;
  if (urlCount > 12) {
    return { ok: false, message: "Too many links in one message. Split across multiple posts." };
  }
  return { ok: true, trimmed };
}

/**
 * Duplicate detection, burst cooldown (3 posts within ~3s → 30s lockout), length.
 */
export async function checkDashboardChatRate(
  supabase: AppSupabaseClient,
  userId: string,
  body: string,
): Promise<DashboardChatRateResult> {
  const mod = moderateDashboardChatContent(body);
  if (!mod.ok) {
    return { allowed: false, message: mod.message };
  }
  const trimmed = mod.trimmed;
  if (!trimmed) {
    return { allowed: false, message: "Message cannot be empty." };
  }
  if (trimmed.length > DASHBOARD_CHAT_MAX_LEN) {
    return {
      allowed: false,
      message: `Message too long (max ${DASHBOARD_CHAT_MAX_LEN} characters).`,
    };
  }

  const nowMs = Date.now();
  const now = new Date(nowMs);

  const { data: row } = await supabase
    .from("dashboard_chat_rate_state")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (row?.cooldown_until && new Date(row.cooldown_until as string) > now) {
    const sec = Math.ceil(
      (new Date(row.cooldown_until as string).getTime() - nowMs) / 1000,
    );
    return {
      allowed: false,
      message: `You're posting too quickly. Try again in ${sec} second${sec === 1 ? "" : "s"}.`,
    };
  }

  if (row?.last_body && (row.last_body as string) === trimmed) {
    return {
      allowed: false,
      message: "You already sent this message. Change the text to post again.",
    };
  }

  const lastMs = row?.last_post_at ? new Date(row.last_post_at as string).getTime() : 0;
  const newBurst = nowMs - lastMs < RAPID_WINDOW_MS ? (row?.burst_count ?? 0) + 1 : 1;

  if (newBurst >= 3) {
    await supabase.from("dashboard_chat_rate_state").upsert({
      user_id: userId,
      last_post_at: now.toISOString(),
      last_body: trimmed,
      burst_count: 0,
      cooldown_until: new Date(nowMs + COOLDOWN_MS).toISOString(),
    });
    return {
      allowed: false,
      message: "Too many messages in a short window. Wait 30 seconds before posting again.",
    };
  }

  return { allowed: true, newBurst, trimmed };
}

export async function persistDashboardChatRateAfterSend(
  supabase: AppSupabaseClient,
  userId: string,
  trimmed: string,
  newBurst: number,
) {
  await supabase.from("dashboard_chat_rate_state").upsert({
    user_id: userId,
    last_post_at: new Date().toISOString(),
    last_body: trimmed,
    burst_count: newBurst,
    cooldown_until: null,
  });
}
