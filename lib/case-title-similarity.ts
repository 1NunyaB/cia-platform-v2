import { normalizeCaseTitle } from "@/lib/case-title";

/** Filtered for overlap scoring; keeps signal, drops noise. */
const STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "of",
  "in",
  "on",
  "for",
  "to",
  "vs",
  "v",
  "case",
  "investigation",
  "project",
]);

function meaningfulTokens(title: string): string[] {
  return normalizeCaseTitle(title)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2 && !STOPWORDS.has(t));
}

function tokenSets(a: string, b: string): { ta: Set<string>; tb: Set<string> } {
  return { ta: new Set(meaningfulTokens(a)), tb: new Set(meaningfulTokens(b)) };
}

/**
 * Conservative 0..1 score: token Jaccard, subset boosts, compact substring for names like "Epstein" vs "Jeffrey Epstein".
 * Not an exact duplicate check — use `normalizeCaseTitle` equality for that.
 */
export function caseTitleSimilarityScore(incoming: string, candidate: string): number {
  const ni = normalizeCaseTitle(incoming);
  const nc = normalizeCaseTitle(candidate);
  if (ni === nc) return 1;

  const { ta, tb } = tokenSets(incoming, candidate);
  if (ta.size === 0 || tb.size === 0) return 0;

  let inter = 0;
  let longShared = 0;
  for (const t of ta) {
    if (tb.has(t)) {
      inter += 1;
      if (t.length >= 5) longShared += 1;
    }
  }

  const union = new Set([...ta, ...tb]).size;
  const jaccard = union > 0 ? inter / union : 0;

  /** One distinctive shared token (e.g. surname) often indicates same subject. */
  const singleStrongTokenBoost =
    inter === 1 && longShared === 1 ? 0.42 : 0;

  const smaller = ta.size <= tb.size ? ta : tb;
  const larger = ta.size <= tb.size ? tb : ta;
  const isSubset =
    smaller.size > 0 && [...smaller].every((t) => larger.has(t));

  const compactI = ni.replace(/\s+/g, "");
  const compactC = nc.replace(/\s+/g, "");
  let substringBoost = 0;
  if (compactI.length >= 4 && compactC.length >= 4) {
    if (compactI.includes(compactC) || compactC.includes(compactI)) {
      substringBoost = 0.72;
    }
  }

  let score = jaccard;
  if (isSubset && inter >= 1) {
    score = Math.max(score, 0.42 + Math.min(0.2, inter * 0.08));
  }
  if (inter >= 2 && jaccard >= 0.22) {
    score = Math.max(score, jaccard + 0.08);
  }
  if (inter >= 1 && jaccard >= 0.35) {
    score = Math.max(score, jaccard);
  }
  score = Math.max(score, substringBoost, singleStrongTokenBoost);

  return Math.min(1, score);
}

/** Minimum score to show as a “similar” suggestion (not exact duplicate). */
export const SIMILAR_CASE_MIN_SCORE = 0.38;

export type CaseRowForSimilarity = {
  id: string;
  title: string;
  updated_at: string;
  description?: string | null;
};

export function rankSimilarCases(
  incomingTitle: string,
  rows: CaseRowForSimilarity[],
  opts?: { limit?: number; excludeIds?: Set<string> },
): { id: string; title: string; updated_at: string; description: string | null; score: number }[] {
  const limit = opts?.limit ?? 8;
  const exclude = opts?.excludeIds ?? new Set<string>();
  const incomingNorm = normalizeCaseTitle(incomingTitle);

  const scored = rows
    .filter((r) => !exclude.has(r.id))
    .map((r) => {
      const score = caseTitleSimilarityScore(incomingTitle, r.title);
      return {
        id: r.id,
        title: r.title,
        updated_at: r.updated_at,
        description: r.description ?? null,
        score,
      };
    })
    .filter((x) => {
      if (normalizeCaseTitle(x.title) === incomingNorm) return false;
      return x.score >= SIMILAR_CASE_MIN_SCORE;
    })
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  return scored.slice(0, limit);
}
