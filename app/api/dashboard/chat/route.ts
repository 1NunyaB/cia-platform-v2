import { createClient } from "@/lib/supabase/server";
import {
  getActiveDashboardChatMute,
  listRecentDashboardChat,
  searchDashboardChat,
} from "@/services/collaboration-service";
import {
  checkDashboardChatRate,
  persistDashboardChatRateAfterSend,
} from "@/lib/dashboard-chat-rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

const postSchema = z.object({
  body: z.string().min(1),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  try {
    const messages =
      q.length >= 2 ? await searchDashboardChat(supabase, q, 200) : await listRecentDashboardChat(supabase, 200);
    const mute = await getActiveDashboardChatMute(supabase, user.id);
    return NextResponse.json({
      messages,
      muted_until: mute?.muted_until ?? null,
      muted_reason: mute?.reason ?? null,
      current_user_id: user.id,
      is_admin: user.email?.trim().toLowerCase() === "kesmall7712@gmail.com",
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load chat";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
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

  const parsed = postSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const rate = await checkDashboardChatRate(supabase, user.id, parsed.data.body);
  if (!rate.allowed) {
    return NextResponse.json({ error: rate.message }, { status: 429 });
  }

  const mute = await getActiveDashboardChatMute(supabase, user.id);
  if (mute) {
    return NextResponse.json(
      {
        error: `You are muted in workspace chat until ${new Date(mute.muted_until).toLocaleTimeString()}.`,
        muted_until: mute.muted_until,
      },
      { status: 403 },
    );
  }

  try {
    const { error } = await supabase.from("dashboard_chat_messages").insert({
      author_id: user.id,
      body: rate.trimmed,
    });
    if (error) throw new Error(error.message);

    await persistDashboardChatRateAfterSend(supabase, user.id, rate.trimmed, rate.newBurst);

    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to send";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
