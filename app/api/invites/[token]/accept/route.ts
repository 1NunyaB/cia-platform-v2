import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const trimmed = token?.trim();
  if (!trimmed) {
    return NextResponse.json({ error: "Missing token" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await supabase.rpc("accept_case_invite", { p_token: trimmed });

  if (error) {
    const msg = error.message || "Could not accept invite";
    const lower = msg.toLowerCase();
    if (lower.includes("not authenticated")) {
      return NextResponse.json({ error: msg }, { status: 401 });
    }
    if (lower.includes("email") || lower.includes("invite")) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const caseId = (data as { case_id?: string } | null)?.case_id;
  if (!caseId || typeof caseId !== "string") {
    return NextResponse.json({ error: "Unexpected response" }, { status: 500 });
  }

  return NextResponse.json({ case_id: caseId });
}
