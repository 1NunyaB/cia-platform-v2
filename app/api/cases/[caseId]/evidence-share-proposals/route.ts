import { createClient } from "@/lib/supabase/server";
import { getCaseById } from "@/services/case-service";
import { createEvidenceShareProposal } from "@/services/evidence-share-proposal-service";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  source_case_id: z.string().uuid(),
  evidence_file_id: z.string().uuid(),
  summary_what: z.string().min(8).max(8000),
  summary_why: z.string().min(8).max(8000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId: targetCaseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const target = await getCaseById(supabase, targetCaseId);
  if (!target) {
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
    const { proposalId } = await createEvidenceShareProposal(supabase, {
      userId: user.id,
      sourceCaseId: parsed.data.source_case_id,
      targetCaseId,
      evidenceFileId: parsed.data.evidence_file_id,
      summaryWhat: parsed.data.summary_what,
      summaryWhy: parsed.data.summary_why,
    });
    return NextResponse.json({ proposal_id: proposalId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not create share proposal";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
