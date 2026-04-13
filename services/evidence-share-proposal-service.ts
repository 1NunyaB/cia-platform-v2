import type { AppSupabaseClient } from "@/types";
import { logActivity } from "@/services/activity-service";

export type EvidenceShareProposalRow = {
  id: string;
  source_case_id: string;
  target_case_id: string;
  evidence_file_id: string;
  proposed_by: string;
  summary_what: string;
  summary_why: string;
  status: "pending" | "accepted" | "declined" | "cancelled";
  created_at: string;
  responded_at: string | null;
  responded_by: string | null;
};

export async function createEvidenceShareProposal(
  supabase: AppSupabaseClient,
  input: {
    userId: string;
    sourceCaseId: string;
    targetCaseId: string;
    evidenceFileId: string;
    summaryWhat: string;
    summaryWhy: string;
  },
): Promise<{ proposalId: string }> {
  const { data, error } = await supabase.rpc("create_evidence_share_proposal", {
    p_source_case_id: input.sourceCaseId,
    p_target_case_id: input.targetCaseId,
    p_evidence_file_id: input.evidenceFileId,
    p_summary_what: input.summaryWhat,
    p_summary_why: input.summaryWhy,
  });

  if (error) throw new Error(error.message);
  const proposalId = data as string;
  if (!proposalId) throw new Error("Share proposal was not created");

  await logActivity(supabase, {
    caseId: input.targetCaseId,
    actorId: input.userId,
    actorLabel: "Analyst",
    action: "evidence_share_proposal.created",
    entityType: "evidence_share_proposal",
    entityId: proposalId,
    payload: {
      source_case_id: input.sourceCaseId,
      evidence_file_id: input.evidenceFileId,
    },
  });

  await logActivity(supabase, {
    caseId: input.sourceCaseId,
    actorId: input.userId,
    actorLabel: "Analyst",
    action: "evidence_share_proposal.created",
    entityType: "evidence_share_proposal",
    entityId: proposalId,
    payload: {
      target_case_id: input.targetCaseId,
      evidence_file_id: input.evidenceFileId,
    },
  });

  return { proposalId };
}

export async function respondToEvidenceShareProposal(
  supabase: AppSupabaseClient,
  input: { userId: string; proposalId: string; accept: boolean },
): Promise<void> {
  const { error } = await supabase.rpc("respond_evidence_share_proposal", {
    p_proposal_id: input.proposalId,
    p_accept: input.accept,
  });
  if (error) throw new Error(error.message);

  const { data: row, error: fetchErr } = await supabase
    .from("evidence_share_proposals")
    .select("id, source_case_id, target_case_id, evidence_file_id, status")
    .eq("id", input.proposalId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);

  const action = input.accept ? "evidence_share_proposal.accepted" : "evidence_share_proposal.declined";
  const r = row as {
    source_case_id: string;
    target_case_id: string;
    evidence_file_id: string;
    status: string;
  } | null;

  if (r) {
    await logActivity(supabase, {
      caseId: r.target_case_id,
      actorId: input.userId,
      actorLabel: "Analyst",
      action,
      entityType: "evidence_share_proposal",
      entityId: input.proposalId,
      payload: {
        source_case_id: r.source_case_id,
        evidence_file_id: r.evidence_file_id,
        outcome: r.status,
      },
    });
    await logActivity(supabase, {
      caseId: r.source_case_id,
      actorId: input.userId,
      actorLabel: "Analyst",
      action,
      entityType: "evidence_share_proposal",
      entityId: input.proposalId,
      payload: {
        target_case_id: r.target_case_id,
        evidence_file_id: r.evidence_file_id,
        outcome: r.status,
      },
    });
  }
}

export async function listNotificationsForUser(supabase: AppSupabaseClient, input?: { limit?: number }) {
  const lim = Math.min(input?.limit ?? 40, 100);
  const { data, error } = await supabase
    .from("user_notifications")
    .select("id, kind, title, body, payload, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(lim);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function markNotificationRead(supabase: AppSupabaseClient, notificationId: string): Promise<void> {
  const { error } = await supabase
    .from("user_notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", notificationId);
  if (error) throw new Error(error.message);
}
