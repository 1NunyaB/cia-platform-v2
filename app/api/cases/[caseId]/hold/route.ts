import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceClient } from "@/lib/supabase/service";
import { NOTIFICATION_KIND } from "@/lib/notification-kinds";
import {
  fetchCaseNotificationRecipientIds,
  fetchProfileAlias,
  insertNotifications,
} from "@/services/notification-service";

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
    .select("id, created_by, title")
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

  const { data: members } = await privileged
    .from("case_members")
    .select("user_id")
    .eq("case_id", caseId);

  const investigatorIds = new Set<string>();
  if (caseRow.created_by) investigatorIds.add(caseRow.created_by as string);
  for (const m of members ?? []) {
    const uid = m.user_id as string | null;
    if (uid) investigatorIds.add(uid);
  }

  await privileged
    .from("case_members")
    .upsert(
      {
        case_id: caseId,
        user_id: user.id,
        role: caseRow.created_by === user.id ? "owner" : "contributor",
        investigator_presence: "away",
        presence_updated_at: nowIso,
      },
      { onConflict: "case_id,user_id" },
    );

  const caseTitle = ((caseRow.title as string) ?? "Investigation").trim();
  const alias = await fetchProfileAlias(privileged, user.id);
  const selfLabel = alias || "An investigator";

  if (investigatorIds.size <= 1) {
    const { error: holdErr } = await privileged
      .from("cases")
      .update({
        investigation_on_hold_at: nowIso,
        investigation_on_hold_by: user.id,
      })
      .eq("id", caseId);
    if (holdErr) {
      return NextResponse.json({ error: holdErr.message }, { status: 500 });
    }

    const recipients = await fetchCaseNotificationRecipientIds(privileged, caseId, user.id);
    if (recipients.length > 0) {
      await insertNotifications(
        recipients.map((uid) => ({
          userId: uid,
          kind: NOTIFICATION_KIND.STATUS_CHANGED,
          title: "Case on hold",
          body: `${caseTitle} was placed on hold.`,
          actorUserId: user.id,
          caseId,
          linkUrl: `/cases/${caseId}`,
          payload: { case_id: caseId, mode: "case_hold" },
        })),
      );
    }

    return NextResponse.json({
      ok: true,
      mode: "case_hold",
      message: "Case is now on hold.",
    });
  }

  const recipientsAway = await fetchCaseNotificationRecipientIds(privileged, caseId, user.id);
  if (recipientsAway.length > 0) {
    await insertNotifications(
      recipientsAway.map((uid) => ({
        userId: uid,
        kind: NOTIFICATION_KIND.INVESTIGATOR_AWAY,
        title: `${selfLabel} marked away`,
        body: `${selfLabel} is away on ${caseTitle}. Other investigators remain active.`,
        actorUserId: user.id,
        caseId,
        linkUrl: `/cases/${caseId}`,
        payload: { case_id: caseId, mode: "user_away" },
      })),
    );
  }

  return NextResponse.json({
    ok: true,
    mode: "user_away",
    message: "Other investigators are still working on this case. You are now marked as away.",
  });
}
