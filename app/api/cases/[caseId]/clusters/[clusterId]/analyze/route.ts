import { createClient } from "@/lib/supabase/server";
import { getCaseById } from "@/services/case-service";
import { runEvidenceClusterAnalysis } from "@/services/evidence-cluster-analysis-service";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ caseId: string; clusterId: string }> },
) {
  const { caseId, clusterId } = await params;
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

  try {
    const result = await runEvidenceClusterAnalysis(supabase, {
      caseId,
      clusterId,
      userId: user.id,
    });
    revalidatePath(`/cases/${caseId}`);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Cluster analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
