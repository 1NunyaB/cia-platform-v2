import { createClient } from "@/lib/supabase/server";
import { assertPlatformAdmin } from "@/lib/admin-guard";
import { logActivity } from "@/services/activity-service";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const muteSchema = z.object({
  userId: z.string().uuid(),
  reason: z.string().trim().max(240).optional(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    assertPlatformAdmin(user);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unauthorized" }, { status: 403 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = muteSchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  if (parsed.data.userId === user.id) {
    return NextResponse.json({ error: "You cannot mute your own account." }, { status: 400 });
  }

  const mutedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
  const reason = parsed.data.reason?.trim() || "Moderation action";

  const { error: muteErr } = await supabase.from("dashboard_chat_mutes").insert({
    user_id: parsed.data.userId,
    muted_by: user.id,
    muted_until: mutedUntil,
    reason,
  });
  if (muteErr) return NextResponse.json({ error: muteErr.message }, { status: 500 });

  const { error: notifyErr } = await supabase.from("user_notifications").insert({
    user_id: parsed.data.userId,
    kind: "chat_mute",
    title: "Chat access paused for 30 minutes",
    body: "You have been muted in workspace chat for 30 minutes. You can still read messages.",
    payload: { muted_until: mutedUntil, reason },
  });
  if (notifyErr) return NextResponse.json({ error: notifyErr.message }, { status: 500 });

  await logActivity(supabase, {
    caseId: null,
    actorId: user.id,
    actorLabel: "Admin",
    action: "dashboard_chat.user_muted",
    entityType: "dashboard_chat_mute",
    entityId: parsed.data.userId,
    payload: { muted_until: mutedUntil, reason },
  });

  return NextResponse.json({ ok: true, muted_until: mutedUntil });
}
