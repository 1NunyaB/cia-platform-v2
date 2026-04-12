/**
 * Normalization for entity labels and alias strings (case-insensitive registry keys).
 * Does not assert identity — only used for matching and deduplication.
 */
export function normalizeEntityOrAliasKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[.,;:'"()[\]{}]/g, "");
}

/** Initials from a human-style name (e.g. "John A. Smith" → ["jas", "js"]). */
export function nameInitialKeys(name: string): string[] {
  const t = name.trim();
  if (!t) return [];
  const parts = t.split(/\s+/).filter((p) => p.length > 0);
  if (parts.length < 2) return [];
  const letters = parts.map((p) => p.replace(/^[^a-z0-9]+/i, "").charAt(0).toLowerCase()).filter(Boolean);
  if (!letters.length) return [];
  const all = letters.join("");
  const firstLast = `${letters[0]}${letters[letters.length - 1]}`;
  const out = new Set<string>();
  if (all.length >= 2) out.add(all);
  if (firstLast.length === 2) out.add(firstLast);
  return [...out];
}

/** Conservative token overlap (Jaccard on word tokens, length ≥ 2). */
export function tokenJaccard(a: string, b: string): number {
  const tok = (s: string) => {
    const words = s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2);
    return new Set(words);
  };
  const A = tok(a);
  const B = tok(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const t of A) {
    if (B.has(t)) inter += 1;
  }
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}
