import { createClient } from "@/lib/supabase/server";
import { markNotificationRead } from "@/services/evidence-share-proposal-service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ notificationId: string }> },
) {
  const { notificationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await markNotificationRead(supabase, notificationId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to update notification";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
