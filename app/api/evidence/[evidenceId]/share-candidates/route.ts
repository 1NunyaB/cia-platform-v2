import { createClient } from "@/lib/supabase/server";
import { buildShareCandidates } from "@/services/evidence-share-relevance";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ evidenceId: string }> },
) {
  const { evidenceId } = await params;
  const { searchParams } = new URL(request.url);
  const excludeCaseId = searchParams.get("excludeCaseId")?.trim() ?? "";

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!excludeCaseId) {
    return NextResponse.json({ error: "excludeCaseId is required" }, { status: 400 });
  }

  try {
    const candidates = await buildShareCandidates(supabase, {
      evidenceId,
      userId: user.id,
      excludeCaseId,
    });
    return NextResponse.json({ candidates }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to rank investigations";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
