import { createClient } from "@/lib/supabase/server";
import { listRecentDashboardChat } from "@/services/collaboration-service";
import {
  checkDashboardChatRate,
  persistDashboardChatRateAfterSend,
} from "@/lib/dashboard-chat-rate-limit";
import { NextResponse } from "next/server";
import { z } from "zod";

const postSchema = z.object({
  body: z.string().min(1),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const messages = await listRecentDashboardChat(supabase, 80);
    return NextResponse.json({ messages });
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
