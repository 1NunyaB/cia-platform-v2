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
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: caseRow, error: caseErr } = await supabase
    .from("cases")
    .select("id, title, created_by")
    .eq("id", caseId)
    .maybeSingle();
  if (caseErr || !caseRow) return NextResponse.json({ error: "Case not found" }, { status: 404 });

  const privileged = tryCreateServiceClient() ?? supabase;

  const { data: priorMember } = await privileged
    .from("case_members")
    .select("id")
    .eq("case_id", caseId)
    .eq("user_id", user.id)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const { error } = await privileged
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
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!priorMember) {
    const recipients = await fetchCaseNotificationRecipientIds(privileged, caseId, user.id);
    if (recipients.length > 0) {
      const alias = await fetchProfileAlias(privileged, user.id);
      const caseTitle = ((caseRow.title as string) ?? "Investigation").trim();
      const label = alias || "An investigator";
      await insertNotifications(
        recipients.map((uid) => ({
          userId: uid,
          kind: NOTIFICATION_KIND.INVESTIGATOR_JOINED,
          title: `${label} joined`,
          body: `${label} joined ${caseTitle}.`,
          actorUserId: user.id,
          caseId,
          linkUrl: `/cases/${caseId}`,
          payload: { case_id: caseId },
        })),
      );
    }
  }

  return NextResponse.json({ ok: true });
}
