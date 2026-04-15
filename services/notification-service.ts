import type { AppSupabaseClient } from "@/types";
import { NOTIFICATION_KIND } from "@/lib/notification-kinds";
import type { NotificationKind } from "@/lib/notification-kinds";
import { tryCreateServiceClient } from "@/lib/supabase/service";

export type UserNotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
  actor_user_id: string | null;
  case_id: string | null;
  link_url: string | null;
};

export type InsertNotificationInput = {
  userId: string;
  kind: NotificationKind | string;
  title: string;
  body?: string | null;
  payload?: Record<string, unknown>;
  actorUserId?: string | null;
  caseId?: string | null;
  linkUrl?: string | null;
};

/**
 * Inserts using the service role when available so recipients need not be the actor.
 */
export async function insertNotifications(rows: InsertNotificationInput[]): Promise<void> {
  if (rows.length === 0) return;
  const db = tryCreateServiceClient();
  if (!db) {
    console.warn("[notifications] service client unavailable; skipping insert");
    return;
  }
  const { error } = await db.from("user_notifications").insert(
    rows.map((r) => ({
      user_id: r.userId,
      kind: r.kind,
      title: r.title,
      body: r.body ?? null,
      payload: r.payload ?? {},
      actor_user_id: r.actorUserId ?? null,
      case_id: r.caseId ?? null,
      link_url: r.linkUrl ?? null,
    })),
  );
  if (error) console.warn("[notifications] insert failed:", error.message);
}

export async function listNotificationsForUser(supabase: AppSupabaseClient, input?: { limit?: number }) {
  const lim = Math.min(input?.limit ?? 40, 100);
  const { data, error } = await supabase
    .from("user_notifications")
    .select(
      "id, kind, title, body, payload, read_at, created_at, actor_user_id, case_id, link_url",
    )
    .order("created_at", { ascending: false })
    .limit(lim);
  if (error) throw new Error(error.message);
  return (data ?? []) as UserNotificationRow[];
}

export async function markNotificationRead(supabase: AppSupabaseClient, notificationId: string): Promise<void> {
  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) throw new Error(error.message);
}

export async function markAllNotificationsRead(supabase: AppSupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("read_at", null);
  if (error) throw new Error(error.message);
}

/** Other case members + creator, excluding `excludeUserId`. */
export async function fetchCaseNotificationRecipientIds(
  db: AppSupabaseClient,
  caseId: string,
  excludeUserId: string,
): Promise<string[]> {
  const p = tryCreateServiceClient() ?? db;
  const recipientSet = new Set<string>();
  const { data: caseRow } = await p.from("cases").select("created_by").eq("id", caseId).maybeSingle();
  const createdBy = caseRow?.created_by as string | null | undefined;
  if (createdBy && createdBy !== excludeUserId) recipientSet.add(createdBy);
  const { data: members } = await p.from("case_members").select("user_id").eq("case_id", caseId);
  for (const m of members ?? []) {
    const uid = m.user_id as string | null;
    if (uid && uid !== excludeUserId) recipientSet.add(uid);
  }
  return [...recipientSet];
}

export async function fetchProfileAlias(db: AppSupabaseClient, userId: string): Promise<string | null> {
  const p = tryCreateServiceClient() ?? db;
  const { data } = await p
    .from("profiles")
    .select("investigator_alias")
    .eq("id", userId)
    .maybeSingle();
  const a = (data?.investigator_alias as string | null)?.trim();
  return a || null;
}

export async function notifyEvidenceAddedToCase(
  db: AppSupabaseClient,
  input: {
    caseId: string;
    evidenceId: string;
    filename: string;
    uploadedByUserId: string;
  },
): Promise<void> {
  const recipients = await fetchCaseNotificationRecipientIds(db, input.caseId, input.uploadedByUserId);
  if (recipients.length === 0) return;
  const p = tryCreateServiceClient() ?? db;
  const { data: c } = await p.from("cases").select("title").eq("id", input.caseId).maybeSingle();
  const title = (c?.title as string | null)?.trim() || "Investigation";
  await insertNotifications(
    recipients.map((userId) => ({
      userId,
      kind: NOTIFICATION_KIND.EVIDENCE_ADDED,
      title: `New evidence — ${title}`,
      body: input.filename,
      actorUserId: input.uploadedByUserId,
      caseId: input.caseId,
      linkUrl: `/cases/${input.caseId}/evidence/${input.evidenceId}`,
      payload: {
        evidence_file_id: input.evidenceId,
        original_filename: input.filename,
      },
    })),
  );
}

export async function notifyCaseNoteAdded(
  db: AppSupabaseClient,
  input: {
    caseId: string;
    noteId: string;
    authorId: string | null;
    bodyPreview: string;
  },
): Promise<void> {
  if (!input.authorId) return;
  const recipients = await fetchCaseNotificationRecipientIds(db, input.caseId, input.authorId);
  if (recipients.length === 0) return;
  const p = tryCreateServiceClient() ?? db;
  const { data: c } = await p.from("cases").select("title").eq("id", input.caseId).maybeSingle();
  const title = (c?.title as string | null)?.trim() || "Investigation";
  const preview = input.bodyPreview.trim().replace(/\s+/g, " ").slice(0, 160);
  await insertNotifications(
    recipients.map((userId) => ({
      userId,
      kind: NOTIFICATION_KIND.NOTE_ADDED,
      title: `New note — ${title}`,
      body: preview || "A note was added.",
      actorUserId: input.authorId,
      caseId: input.caseId,
      linkUrl: `/cases/${input.caseId}#case-notes`,
      payload: { note_id: input.noteId },
    })),
  );
}
