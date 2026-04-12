/**
 * Doctrine for alias / identity-variant extraction — wired into investigation analysis prompts.
 * Conservative: weak similarity is never treated as confirmed identity.
 */
export const ALIAS_IDENTITY_DOCTRINE = `Alias and identity variants (supplemental "entities" only)
- For each entity, the canonical "label" is the primary name as it should appear in the registry. Never replace it with a nickname in the label field.
- Optional "aliases" array: only include alternate spellings, nicknames, initials, shorthand, usernames, or "also known as" forms that are **explicitly supported** by the extract (quoted, stated relationship, signature line, email header, or unambiguous same-document reference). Omit the array or leave it empty when unsupported.
- Each alias entry: { "alias": string, "strength": "weak" | "moderate" | "strong", "basis": string }.
  - "strong": same document explicitly ties the alias to the primary name (e.g. "Jane Doe (JD)", "aka …", "signed J.D.").
  - "moderate": clear contextual linkage in-text but not a formal AKA line.
  - "weak": possible nickname or pattern — list it but do not treat as proof of identity elsewhere; the platform will keep classification conservative.
- Do **not** merge different people who merely share a similar name. If ambiguity remains, omit the alias or mark it weak and explain in "basis".
- Do not invent aliases from filename alone or from guessed hidden text.

Alias-focused evidence clusters (optional)
- In "evidence_clusters", you may set "cluster_kind" to "alias_focused" when the grouping is driven primarily by shared identity markers, nicknames, or resolved aliases across files (not merely a thematic theme). Otherwise omit or use "standard".
- Cluster titles should keep the primary entity or topic name visible; do not hide the main identity behind only a nickname in the title unless the extract does.`;
