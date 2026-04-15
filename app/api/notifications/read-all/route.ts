import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { markAllNotificationsRead } from "@/services/notification-service";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await markAllNotificationsRead(supabase, user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to mark all read";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
