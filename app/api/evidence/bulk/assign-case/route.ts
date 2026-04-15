import { createClient } from "@/lib/supabase/server";
import { bulkAssignEvidenceToCase } from "@/services/evidence-service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    evidenceIds?: string[];
    caseId?: string;
  };
  const caseId = body.caseId?.trim();
  const evidenceIds = Array.isArray(body.evidenceIds)
    ? body.evidenceIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  if (!caseId) {
    return NextResponse.json({ error: "caseId is required" }, { status: 400 });
  }
  if (evidenceIds.length === 0) {
    return NextResponse.json({ error: "evidenceIds is required" }, { status: 400 });
  }

  const { results } = await bulkAssignEvidenceToCase(supabase, {
    evidenceIds,
    targetCaseId: caseId,
    userId: user.id,
  });

  return NextResponse.json({ results });
}
