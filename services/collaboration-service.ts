import { normalizeStructuredFinding } from "@/lib/schemas/structured-finding";
import { normalizeAuthenticityLabel, normalizeAuthenticityNotes } from "@/lib/schemas/authenticity-schema";
import { normalizeConcealedLanguageAnalysis } from "@/lib/schemas/concealed-language-schema";
import { enforceFindingDiscipline } from "@/services/analysis-finding-validation";
import type { AppSupabaseClient } from "@/types";
import { ANALYSIS_FORMAT_VERSION, type ClusterAnalysisView } from "@/types/analysis";

export type StickyNoteRow = {
  id: string;
  case_id: string;
  evidence_file_id: string;
  author_id: string | null;
  author_label: string | null;
  body: string;
  created_at: string;
};

export type StickyReplyRow = {
  id: string;
  sticky_note_id: string;
  author_id: string | null;
  author_label: string | null;
  body: string;
  created_at: string;
};

export async function listStickyNotesWithReplies(
  supabase: AppSupabaseClient,
  evidenceId: string,
): Promise<{ sticky: StickyNoteRow; replies: StickyReplyRow[] }[]> {
  const { data: stickies, error } = await supabase
    .from("evidence_sticky_notes")
    .select("*")
    .eq("evidence_file_id", evidenceId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);

  const out: { sticky: StickyNoteRow; replies: StickyReplyRow[] }[] = [];
  for (const s of stickies ?? []) {
    const { data: replies, error: rErr } = await supabase
      .from("evidence_sticky_note_replies")
      .select("*")
      .eq("sticky_note_id", s.id as string)
      .order("created_at", { ascending: true });
    if (rErr) throw new Error(rErr.message);
    out.push({
      sticky: s as StickyNoteRow,
      replies: (replies ?? []) as StickyReplyRow[],
    });
  }
  return out;
}

function parseClusterAnalysisStructured(raw: unknown): ClusterAnalysisView {
  if (!raw || typeof raw !== "object") {
    return {
      finding: enforceFindingDiscipline(normalizeStructuredFinding({}), { scope: "evidence_cluster" }),
      authenticityLabel: "unverified",
    };
  }
  const o = raw as Record<string, unknown>;
  if (o.format_version === ANALYSIS_FORMAT_VERSION && o.finding && typeof o.finding === "object") {
    const finding = enforceFindingDiscipline(normalizeStructuredFinding(o.finding), {
      scope: "evidence_cluster",
    });
    const notes = normalizeAuthenticityNotes(o.authenticity_notes);
    const concealedLanguageAnalysis = normalizeConcealedLanguageAnalysis(o.concealed_language_analysis ?? null);
    return {
      finding,
      authenticityLabel: normalizeAuthenticityLabel(o.authenticity_label),
      ...(notes ? { authenticityNotes: notes } : {}),
      ...(concealedLanguageAnalysis ? { concealedLanguageAnalysis } : {}),
    };
  }
  const finding = enforceFindingDiscipline(normalizeStructuredFinding(raw), { scope: "evidence_cluster" });
  return { finding, authenticityLabel: "unverified" };
}

export async function listClusterAnalysesForCase(
  supabase: AppSupabaseClient,
  caseId: string,
): Promise<Record<string, ClusterAnalysisView>> {
  const { data, error } = await supabase
    .from("evidence_cluster_analyses")
    .select("cluster_id, structured")
    .eq("case_id", caseId);
  if (error) throw new Error(error.message);
  const map: Record<string, ClusterAnalysisView> = {};
  for (const row of data ?? []) {
    map[row.cluster_id as string] = parseClusterAnalysisStructured(row.structured);
  }
  return map;
}

export type DashboardChatMessageRow = {
  id: string;
  author_id: string | null;
  author_label: string | null;
  body: string;
  created_at: string;
};

export type DashboardChatMuteRow = {
  id: string;
  user_id: string;
  muted_until: string;
  reason: string | null;
  muted_by: string | null;
  created_at: string;
};

export async function listRecentDashboardChat(
  supabase: AppSupabaseClient,
  limit = 200,
): Promise<DashboardChatMessageRow[]> {
  const lim = Math.min(Math.max(limit, 1), 500);
  const { data, error } = await supabase
    .from("dashboard_chat_messages")
    .select("id, author_id, author_label, body, created_at")
    .order("created_at", { ascending: false })
    .limit(lim);
  if (error) throw new Error(error.message);
  return ((data ?? []) as DashboardChatMessageRow[]).reverse();
}

/** Search workspace chat history (persistent messages). */
export async function searchDashboardChat(
  supabase: AppSupabaseClient,
  query: string,
  limit = 150,
): Promise<DashboardChatMessageRow[]> {
  const q = query.trim();
  if (q.length < 2) {
    return listRecentDashboardChat(supabase, limit);
  }
  const lim = Math.min(Math.max(limit, 1), 500);
  const safe = q.replace(/[%_]/g, " ").trim();
  if (safe.length < 2) {
    return listRecentDashboardChat(supabase, limit);
  }
  const { data, error } = await supabase
    .from("dashboard_chat_messages")
    .select("id, author_id, author_label, body, created_at")
    .ilike("body", `%${safe}%`)
    .order("created_at", { ascending: false })
    .limit(lim);
  if (error) throw new Error(error.message);
  return ((data ?? []) as DashboardChatMessageRow[]).reverse();
}

export async function getActiveDashboardChatMute(
  supabase: AppSupabaseClient,
  userId: string,
): Promise<DashboardChatMuteRow | null> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("dashboard_chat_mutes")
    .select("id, user_id, muted_until, reason, muted_by, created_at")
    .eq("user_id", userId)
    .gt("muted_until", now)
    .order("muted_until", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as DashboardChatMuteRow | null) ?? null;
}
