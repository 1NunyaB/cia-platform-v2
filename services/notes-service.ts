import type { AppSupabaseClient } from "@/types";
import type { CaseNoteVisibility } from "@/types/collaboration";
import { logActivity } from "@/services/activity-service";
import { notifyCaseNoteAdded } from "@/services/notification-service";
import { recordContribution } from "@/services/contributions-service";

export async function addCaseNote(
  supabase: AppSupabaseClient,
  input: {
    caseId: string;
    authorId: string | null;
    authorLabel?: string | null;
    body: string;
    evidenceFileId?: string | null;
    visibility?: CaseNoteVisibility;
  },
) {
  const label = input.authorLabel?.trim() || "Analyst";
  const visibility = input.visibility ?? "shared_case";
  const { data, error } = await supabase
    .from("notes")
    .insert({
      case_id: input.caseId,
      user_id: input.userId,
      user_label: input.userId ? null : label,
      body: input.body,
      evidence_file_id: input.evidenceFileId ?? null,
      visibility,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  if (input.authorId) {
    await recordContribution(supabase, {
      caseId: input.caseId,
      userId: input.authorId,
      kind: "note",
      refId: data!.id as string,
    });
  }

  await logActivity(supabase, {
    caseId: input.caseId,
    actorId: input.authorId,
    actorLabel: label,
    action: "note.created",
    entityType: "note",
    entityId: data!.id as string,
  });

  if (input.authorId) {
    void notifyCaseNoteAdded(supabase, {
      caseId: input.caseId,
      noteId: data!.id as string,
      authorId: input.authorId,
      bodyPreview: input.body,
    }).catch(() => {
      /* non-blocking */
    });
  }

  return { id: data!.id as string };
}

export async function addComment(
  supabase: AppSupabaseClient,
  input: {
    caseId: string;
    authorId: string;
    body: string;
    evidenceFileId?: string | null;
    noteId?: string | null;
    parentCommentId?: string | null;
  },
) {
  const { data, error } = await supabase
    .from("comments")
    .insert({
      case_id: input.caseId,
      user_id: input.userId,
      body: input.body,
      evidence_file_id: input.evidenceFileId ?? null,
      note_id: input.noteId ?? null,
      parent_comment_id: input.parentCommentId ?? null,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  await recordContribution(supabase, {
    caseId: input.caseId,
    userId: input.authorId,
    kind: "comment",
    refId: data!.id as string,
  });

  await logActivity(supabase, {
    caseId: input.caseId,
    actorId: input.authorId,
    actorLabel: "Analyst",
    action: "comment.created",
    entityType: "comment",
    entityId: data!.id as string,
  });

  return { id: data!.id as string };
}

export async function listNotesForCase(supabase: AppSupabaseClient, caseId: string) {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("case_id", caseId)
    .is("evidence_file_id", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listNotesForEvidence(supabase: AppSupabaseClient, caseId: string, evidenceId: string) {
  const { data, error } = await supabase
    .from("notes")
    .select("*")
    .eq("case_id", caseId)
    .eq("evidence_file_id", evidenceId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listCommentsForCase(supabase: AppSupabaseClient, caseId: string) {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listCommentsForEvidence(supabase: AppSupabaseClient, caseId: string, evidenceId: string) {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("case_id", caseId)
    .eq("evidence_file_id", evidenceId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listActivity(supabase: AppSupabaseClient, caseId: string, limit = 50) {
  const { data, error } = await supabase
    .from("activity_log")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
