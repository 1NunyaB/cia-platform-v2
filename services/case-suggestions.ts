import type { AppSupabaseClient } from "@/types";
import { normalizeCaseTitle } from "@/lib/case-title";
import { rankSimilarCases, type CaseRowForSimilarity } from "@/lib/case-title-similarity";

export type CaseExactMatch = {
  id: string;
  title: string;
  updated_at: string;
};

export type CaseSimilarSuggestion = {
  id: string;
  title: string;
  updated_at: string;
  description: string | null;
  score: number;
};

const CANDIDATE_LIMIT = 650;

/**
 * Exact normalized title (global) + conservative similar titles for create-case UX.
 * Uses service-capable client so candidates are not limited by RLS membership.
 */
export async function buildCaseSuggestions(
  supabase: AppSupabaseClient,
  title: string,
): Promise<{ exactMatch: CaseExactMatch | null; similar: CaseSimilarSuggestion[] }> {
  const normalized = normalizeCaseTitle(title);
  if (!normalized) {
    return { exactMatch: null, similar: [] };
  }

  let exactId: string | null = null;
  const { data: rpcId, error: rpcErr } = await supabase.rpc("find_case_by_normalized_title", {
    p_normalized: normalized,
  });
  if (!rpcErr && rpcId != null && rpcId !== "") {
    exactId = String(rpcId);
  }

  const { data: rows, error: listErr } = await supabase
    .from("cases")
    .select("id, title, updated_at, description")
    .order("updated_at", { ascending: false })
    .limit(CANDIDATE_LIMIT);

  if (listErr) {
    console.warn("[case suggestions] cases list:", listErr.message);
    return { exactMatch: null, similar: [] };
  }

  const list = (rows ?? []) as CaseRowForSimilarity[];

  if (!exactId) {
    const hit = list.find((r) => normalizeCaseTitle(r.title) === normalized);
    if (hit) exactId = hit.id;
  }

  let exactMatch: CaseExactMatch | null = null;
  if (exactId) {
    const row = list.find((r) => r.id === exactId);
    if (row) {
      exactMatch = {
        id: row.id,
        title: row.title,
        updated_at: row.updated_at,
      };
    } else {
      const { data: one } = await supabase
        .from("cases")
        .select("id, title, updated_at")
        .eq("id", exactId)
        .maybeSingle();
      if (one) {
        exactMatch = {
          id: one.id as string,
          title: one.title as string,
          updated_at: one.updated_at as string,
        };
      }
    }
  }

  const exclude = new Set<string>();
  if (exactId) exclude.add(exactId);

  const similar = rankSimilarCases(title, list, { limit: 8, excludeIds: exclude });

  return { exactMatch, similar };
}
