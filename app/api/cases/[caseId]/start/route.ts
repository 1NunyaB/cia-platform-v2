import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceClient } from "@/lib/supabase/service";
import { NOTIFICATION_KIND } from "@/lib/notification-kinds";
import { insertNotifications } from "@/services/notification-service";

export async function POST(
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

  const { data: caseRow, error: caseErr } = await supabase
    .from("cases")
    .select("id, title, created_by, investigation_started_at")
    .eq("id", caseId)
    .maybeSingle();
  if (caseErr || !caseRow) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const { data: memberRow } = await supabase
    .from("case_members")
    .select("id")
    .eq("case_id", caseId)
    .eq("user_id", user.id)
    .maybeSingle();
  const hasAccess = caseRow.created_by === user.id || !!memberRow;
  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const privileged = tryCreateServiceClient() ?? supabase;
  const nowIso = new Date().toISOString();

  const { error: presenceErr } = await privileged
    .from("case_members")
    .upsert(
      {
        case_id: caseId,
        user_id: user.id,
        role: caseRow.created_by === user.id ? "owner" : "contributor",
        investigator_presence: "active",
        presence_updated_at: nowIso,
      },
      { onConflict: "case_id,user_id" },
    );
  if (presenceErr) {
    return NextResponse.json({ error: presenceErr.message }, { status: 500 });
  }

  if (caseRow.investigation_started_at) {
    return NextResponse.json({ ok: true, alreadyStarted: true });
  }

  const { error: updateErr } = await privileged
    .from("cases")
    .update({
      investigation_started_at: nowIso,
      investigation_started_by: user.id,
      investigation_on_hold_at: null,
      investigation_on_hold_by: null,
    })
    .eq("id", caseId)
    .is("investigation_started_at", null);
  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  const recipientSet = new Set<string>();
  if (caseRow.created_by && caseRow.created_by !== user.id) recipientSet.add(caseRow.created_by as string);
  const { data: recipients } = await privileged
    .from("case_members")
    .select("user_id")
    .eq("case_id", caseId);
  for (const r of recipients ?? []) {
    const uid = r.user_id as string | null;
    if (!uid || uid === user.id) continue;
    recipientSet.add(uid);
  }
  if (recipientSet.size > 0) {
    const titleText = (caseRow.title as string) ?? "Investigation";
    await insertNotifications(
      [...recipientSet].map((recipientId) => ({
        userId: recipientId,
        kind: NOTIFICATION_KIND.CASE_STARTED,
        title: "Investigation started",
        body: `${titleText} is now actively being worked.`,
        actorUserId: user.id,
        caseId,
        linkUrl: `/cases/${caseId}`,
        payload: {
          case_id: caseId,
          started_by: user.id,
        },
      })),
    );
  }

  return NextResponse.json({ ok: true });
}
