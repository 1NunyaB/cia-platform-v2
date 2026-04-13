import type { CaseExactMatch, CaseSimilarSuggestion } from "@/services/case-suggestions";

export type CaseSuggestionsResponse = {
  exactMatch: CaseExactMatch | null;
  similar: CaseSimilarSuggestion[];
};

export async function fetchCaseSuggestions(title: string): Promise<CaseSuggestionsResponse | null> {
  const q = title.trim();
  if (!q) return null;
  const res = await fetch(`/api/cases/suggestions?${new URLSearchParams({ title: q })}`);
  if (!res.ok) return null;
  return (await res.json()) as CaseSuggestionsResponse;
}
