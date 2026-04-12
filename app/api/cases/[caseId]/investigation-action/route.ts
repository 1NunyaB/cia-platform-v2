import { createClient } from "@/lib/supabase/server";
import { getCaseById } from "@/services/case-service";
import { runCaseInvestigationAction } from "@/services/case-investigation-action-service";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  action: z.enum([
    "explain_relevance",
    "corroboration",
    "contradictions",
    "summarize_evidence",
    "group_related_evidence",
  ]),
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
    const { finding } = await runCaseInvestigationAction(supabase, {
      caseId,
      userId: user.id,
      action: parsed.data.action,
    });
    return NextResponse.json({ finding });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Investigation action failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
