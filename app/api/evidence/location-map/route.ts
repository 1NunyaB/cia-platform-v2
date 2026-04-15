import { createClient } from "@/lib/supabase/server";
import { listLocationMapPinsForUser } from "@/services/evidence-service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Pins for `/map`: location-category evidence with valid stored coordinates (RLS-scoped). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const pins = await listLocationMapPinsForUser(supabase);
    return NextResponse.json({ pins });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load map";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
