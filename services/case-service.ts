import type { AppSupabaseClient, CaseRow, CaseMemberRole, CaseVisibility } from "@/types";
import { logActivity } from "@/services/activity-service";
import { recordContribution } from "@/services/contributions-service";

export async function createCase(
  supabase: AppSupabaseClient,
  input: {
    userId: string;
    title: string;
    description?: string | null;
    visibility: CaseVisibility;
  },
) {
  const { data: created, error } = await supabase
    .from("cases")
    .insert({
      title: input.title,
      description: input.description ?? null,
      visibility: input.visibility,
      created_by: input.userId,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  const caseId = created!.id as string;

  await logActivity(supabase, {
    caseId,
    actorId: input.userId,
    actorLabel: "System",
    action: "case.created",
    entityType: "case",
    entityId: caseId,
  });

  return { id: caseId };
}

const normTitle = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Find a case with the same normalized title + visibility created within the time window.
 * Does not filter by `created_by` — works for no-auth / nullable creator and avoids RLS gaps on
 * that column. Never throws: logs DB errors and returns null so POST /api/cases can still create.
 */
export async function findRecentDuplicateCaseInWindow(
  supabase: AppSupabaseClient,
  input: {
    title: string;
    visibility: CaseVisibility;
    windowSec?: number;
  },
): Promise<string | null> {
  const windowSec = input.windowSec ?? 120;
  const since = new Date(Date.now() - windowSec * 1000).toISOString();
  const { data, error } = await supabase
    .from("cases")
    .select("id, title")
    .eq("visibility", input.visibility)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(80);
  if (error) {
    console.warn("[case dedupe] cases query failed:", error.message);
    return null;
  }
  const t = normTitle(input.title);
  const hit = (data ?? []).find((c) => normTitle((c.title as string) ?? "") === t);
  return hit ? (hit.id as string) : null;
}

const activityTs = (iso: string) => Date.parse(iso) || 0;

/**
 * Ensures one row per case id (defensive against duplicate rows from any source) and sorts by
 * most recently touched case first (updated_at, then created_at).
 */
export function dedupeCasesByIdSortByRecent(cases: CaseRow[]): CaseRow[] {
  const byId = new Map<string, CaseRow>();
  for (const c of cases) {
    const id = c.id?.trim();
    if (!id) continue;
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, c);
      continue;
    }
    const nextU = activityTs(c.updated_at);
    const prevU = activityTs(prev.updated_at);
    if (nextU > prevU || (nextU === prevU && activityTs(c.created_at) > activityTs(prev.created_at))) {
      byId.set(id, c);
    }
  }
  return [...byId.values()].sort((a, b) => {
    const d = activityTs(b.updated_at) - activityTs(a.updated_at);
    if (d !== 0) return d;
    return activityTs(b.created_at) - activityTs(a.created_at);
  });
}

export async function listCasesForUser(supabase: AppSupabaseClient, userId: string) {
  const { data: memberships, error: mErr } = await supabase
    .from("case_members")
    .select("case_id")
    .eq("user_id", userId);
  if (mErr) throw new Error(mErr.message);

  const { data: createdRows, error: cErr } = await supabase
    .from("cases")
    .select("id")
    .eq("created_by", userId);
  if (cErr) throw new Error(cErr.message);

  /** One id per case: union of membership and creator access (Set drops duplicate ids from either query). */
  const idSet = new Set<string>();
  for (const r of memberships ?? []) {
    const cid = r.case_id as string;
    if (cid) idSet.add(cid);
  }
  for (const r of createdRows ?? []) {
    const cid = r.id as string;
    if (cid) idSet.add(cid);
  }

  const ids = [...idSet];
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .in("id", ids)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return dedupeCasesByIdSortByRecent((data ?? []) as CaseRow[]);
}

export async function listPublicCases(supabase: AppSupabaseClient) {
  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .eq("visibility", "public")
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Service-role or privileged client: list cases for workspace home (no membership filter). */
export async function listAllCases(supabase: AppSupabaseClient) {
  const { data, error } = await supabase
    .from("cases")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getCaseById(supabase: AppSupabaseClient, caseId: string) {
  const { data, error } = await supabase.from("cases").select("*").eq("id", caseId).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getCaseMembers(supabase: AppSupabaseClient, caseId: string) {
  const { data: members, error } = await supabase
    .from("case_members")
    .select("id, user_id, role, created_at")
    .eq("case_id", caseId);
  if (error) throw new Error(error.message);
  const userIds = [...new Set((members ?? []).map((m) => m.user_id as string))];
  if (userIds.length === 0) return [];

  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url")
    .in("id", userIds);
  if (pErr) throw new Error(pErr.message);

  const byId = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));

  return (members ?? []).map((m) => ({
    ...m,
    profile: byId[m.user_id as string] ?? null,
  }));
}

export async function inviteToCase(
  supabase: AppSupabaseClient,
  input: {
    caseId: string;
    email: string;
    role: CaseMemberRole;
    invitedBy: string;
  },
) {
  const token = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expires = new Date();
  expires.setDate(expires.getDate() + 7);

  const { data, error } = await supabase
    .from("case_invites")
    .insert({
      case_id: input.caseId,
      email: input.email.trim().toLowerCase(),
      role: input.role,
      token,
      invited_by: input.invitedBy,
      expires_at: expires.toISOString(),
    })
    .select("id, token")
    .single();

  if (error) throw new Error(error.message);

  await recordContribution(supabase, {
    caseId: input.caseId,
    userId: input.invitedBy,
    kind: "invite",
    refId: data!.id as string,
    meta: { email: input.email },
  });

  await logActivity(supabase, {
    caseId: input.caseId,
    actorId: input.invitedBy,
    actorLabel: "Analyst",
    action: "case.invite_sent",
    entityType: "invite",
    entityId: data!.id as string,
    payload: { email: input.email },
  });

  return { token: data!.token as string, inviteId: data!.id as string };
}
