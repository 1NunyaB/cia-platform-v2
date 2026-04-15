import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** List evidence stacks (clusters) for a case — for PDF page actions and similar UIs. */
export async function GET(
  _request: Request,
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

  const { data, error } = await supabase
    .from("evidence_clusters")
    .select("id, title")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ clusters: data ?? [] });
}
