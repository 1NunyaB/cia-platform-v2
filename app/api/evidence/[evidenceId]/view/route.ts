import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { logActivity } from "@/services/activity-service";

export const runtime = "nodejs";

/** Record that the signed-in user opened this evidence (for viewed-state bullets). */
export async function POST(_request: Request, { params }: { params: Promise<{ evidenceId: string }> }) {
  const { evidenceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase.from("evidence_file_views").upsert(
    {
      user_id: user.id,
      evidence_file_id: evidenceId,
      viewed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,evidence_file_id" },
  );

  if (error) {
    console.warn("[evidence view]", error.message);
    return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
  }
  try {
    const { data: ev } = await supabase
      .from("evidence_files")
      .select("case_id")
      .eq("id", evidenceId)
      .maybeSingle();
    await logActivity(supabase, {
      caseId: (ev?.case_id as string | null) ?? null,
      actorId: user.id,
      actorLabel: "Analyst",
      action: "evidence.opened",
      entityType: "evidence_file",
      entityId: evidenceId,
      payload: {},
    });
  } catch {
    /* non-blocking */
  }
  return NextResponse.json({ ok: true });
}
