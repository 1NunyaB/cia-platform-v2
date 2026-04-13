import { createClient } from "@/lib/supabase/server";
import { listNotificationsForUser } from "@/services/evidence-share-proposal-service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const notifications = await listNotificationsForUser(supabase, { limit: 50 });
    return NextResponse.json({ notifications });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load notifications";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
