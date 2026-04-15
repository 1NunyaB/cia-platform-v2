import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { loadDashboardEvidencePreviewRows } from "@/services/dashboard-evidence-preview";

/**
 * Client-fetched dashboard evidence list — keeps RSC payload small by not passing
 * large evidence arrays from the server component tree.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("caseId");
  const caseId = raw?.trim() ? raw.trim() : null;

  try {
    const { rows, capped } = await loadDashboardEvidencePreviewRows(supabase, user.id, caseId);
    return NextResponse.json({ rows, capped });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load evidence";
    return NextResponse.json(
      { rows: [], capped: false, error: message.length > 200 ? "Failed to load evidence" : message },
      { status: 500 },
    );
  }
}
