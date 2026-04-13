import { createClient } from "@/lib/supabase/server";
import { getCaseById } from "@/services/case-service";
import { runCrossCaseIntelligenceQuery } from "@/services/cross-case-intelligence-service";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  query: z.string().min(8).max(2000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const c = await getCaseById(supabase, caseId);
  if (!c) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { finding, cross_case_sources, share_suggestion } = await runCrossCaseIntelligenceQuery(supabase, {
      currentCaseId: caseId,
      userId: user.id,
      query: parsed.data.query,
    });
    return NextResponse.json({ finding, cross_case_sources, share_suggestion });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Cross-investigation query failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
