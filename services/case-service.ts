import type { AppSupabaseClient, CaseRow, CaseMemberRole } from "@/types";
import type { CaseListFilters } from "@/lib/case-list-filters";
import { filterCasesByMetadata } from "@/lib/case-list-filters";
import { normalizeCaseTitle } from "@/lib/case-title";
import { logActivity } from "@/services/activity-service";
import { recordContribution } from "@/services/contributions-service";

/** New investigations are always shared (public listing). */
const NEW_CASE_VISIBILITY = "public" as const;

function emptyToNull(s: string | null | undefined): string | null {
  const t = s?.trim();
  return t ? t : null;
}

export async function createCase(
  supabase: AppSupabaseClient,
  input: {
    userId: string;
    title: string;
    description?: string | null;
    incident_year?: number | null;
    incident_city?: string | null;
    incident_state?: string | null;
    accused_label?: string | null;
    victim_labels?: string | null;
    known_weapon?: string | null;
  },
) {
  const { data: created, error } = await supabase
    .from("cases")
    .insert({
      title: input.title,
      description: input.description ?? null,
      visibility: NEW_CASE_VISIBILITY,
      created_by: input.userId,
      incident_year: input.incident_year ?? null,
      incident_city: emptyToNull(input.incident_city ?? undefined),
      incident_state: emptyToNull(input.incident_state ?? undefined),
      accused_label: emptyToNull(input.accused_label ?? undefined),
      victim_labels: emptyToNull(input.victim_labels ?? undefined),
      known_weapon: emptyToNull(input.known_weapon ?? undefined),
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

/**
 * If any case already uses this normalized title, return its id (no second row for the same title).
 * `created_by` remains for audit only. Uses `find_case_by_normalized_title`.
 */
export async function findExistingCaseByNormalizedTitle(
  supabase: AppSupabaseClient,
  input: { title: string },
): Promise<string | null> {
  const normalized = normalizeCaseTitle(input.title);
  if (!normalized) return null;
  const { data, error } = await supabase.rpc("find_case_by_normalized_title", {
    p_normalized: normalized,
  });
  if (error) {
    if (!error.message.includes("does not exist") && !error.message.includes("schema cache")) {
      console.warn("[case dedupe] find_case_by_normalized_title:", error.message);
    }
    return null;
  }
  if (data == null || data === "") return null;
  return String(data);
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

export async function listCasesForUser(
  supabase: AppSupabaseClient,
  userId: string,
  filters?: CaseListFilters | null,
) {
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
  let rows = dedupeCasesByIdSortByRecent((data ?? []) as CaseRow[]);
  if (filters) {
    rows = filterCasesByMetadata(rows, filters);
  }
  return rows;
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
