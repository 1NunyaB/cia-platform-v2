import { createClient } from "@/lib/supabase/server";
import { isInvestigationStackKind } from "@/lib/investigation-stacks";
import type { InvestigationStackKind } from "@/lib/investigation-stacks";
import { bulkAddEvidenceToInvestigationStacks } from "@/services/investigation-stack-service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

  const body = (await request.json().catch(() => ({}))) as {
    evidenceIds?: string[];
    stackKinds?: string[];
  };
  const evidenceIds = Array.isArray(body.evidenceIds)
    ? body.evidenceIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  const rawKinds = Array.isArray(body.stackKinds) ? body.stackKinds : [];
  const stackKinds = rawKinds.filter((k): k is InvestigationStackKind => isInvestigationStackKind(String(k)));

  if (evidenceIds.length === 0) {
    return NextResponse.json({ error: "evidenceIds is required" }, { status: 400 });
  }
  if (stackKinds.length === 0) {
    return NextResponse.json({ error: "stackKinds is required" }, { status: 400 });
  }

  const { results } = await bulkAddEvidenceToInvestigationStacks(supabase, {
    caseId,
    evidenceIds,
    stackKinds,
  });

  return NextResponse.json({ results });
}
