import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCaseSnapshot } from "@/services/case-snapshot-service";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snapshot = await buildCaseSnapshot(supabase, caseId);
  if (!snapshot) return NextResponse.json({ error: "Case not found" }, { status: 404 });
  return NextResponse.json(snapshot);
}

