/**
 * Crowd Investigations Agency — database vs index (navigation layer)
 *
 * **Database (source of truth)** — `evidence_files` and related rows (`extracted_texts`, `ai_analyses`, storage objects).
 * Display filename, short alias, and original filename live only here. Nothing in the index layer re-derives or renames them.
 *
 * **Index (derived navigation)** — `getCaseIndexSnapshot` / case index panel: clusters, aliases, timeline buckets,
 * source groupings, and `evidenceItems` are computed reads joined from the database + graph tables. The index reads
 * `display_filename`, `short_alias`, and `original_filename` from `evidence_files` so labels match everywhere.
 *
 * Keep ingest/register logic the single writer for `display_filename` and `short_alias` (see `evidence-service.ts`,
 * `evidence-display-alias.ts`).
 */

export const EVIDENCE_INDEX_LAYER_NOTE =
  "Index snapshots are read-only projections; evidence_files is the canonical store for names and aliases.";
