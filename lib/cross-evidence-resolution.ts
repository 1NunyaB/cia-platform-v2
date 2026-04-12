/**
 * Cross-evidence resolution: clusters and links use extracted text, entities, contacts, and overlap.
 * Filename hints are weak metadata (tie-break), never the sole basis for linkage — see persistEvidenceClusters.
 */
import type { AppSupabaseClient } from "@/types";
import type { AnalysisSupplemental, SupplementalEntity } from "@/types/analysis";

const MIN_SCORE_INFERRED_LINK = 14;
const MIN_SCORE_CLUSTER_MEMBER = 10;
const ENTITY_MATCH_WEIGHT = 14;
const CONTACT_EMAIL_WEIGHT = 28;
const CONTACT_PHONE_WEIGHT = 22;
const TEXT_JACCARD_WEIGHT = 32;
/** Optional filename hint match — tie-break / weak signal only, not sufficient alone. */
const FILENAME_HINT_BOOST = 12;

export type EvidenceContentProfile = {
  id: string;
  filename: string;
  entityLabels: Set<string>;
  emails: Set<string>;
  phones: Set<string>;
  words: Set<string>;
};

function normLabel(s: string): string {
  return s.trim().toLowerCase();
}

function basenameOnly(name: string): string {
  const t = name.trim();
  const parts = t.split(/[/\\]/);
  return parts[parts.length - 1] ?? t;
}

function extractEmails(text: string): Set<string> {
  const set = new Set<string>();
  const re = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) set.add(m[0].toLowerCase());
  return set;
}

function extractPhones(text: string): Set<string> {
  const set = new Set<string>();
  const re = /\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const d = m[0].replace(/\D/g, "");
    if (d.length >= 10) set.add(d);
  }
  return set;
}

function significantWords(text: string): Set<string> {
  const set = new Set<string>();
  const parts = text.toLowerCase().split(/[^a-z0-9]+/i);
  for (const p of parts) {
    if (p.length >= 4) set.add(p);
  }
  return set;
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

function setOverlapCount(a: Set<string>, b: Set<string>): number {
  let n = 0;
  for (const x of a) if (b.has(x)) n++;
  return n;
}

export function scoreContentAffinity(a: EvidenceContentProfile, b: EvidenceContentProfile): number {
  let score = 0;
  score += setOverlapCount(a.entityLabels, b.entityLabels) * ENTITY_MATCH_WEIGHT;
  for (const e of a.emails) if (b.emails.has(e)) score += CONTACT_EMAIL_WEIGHT;
  for (const p of a.phones) if (b.phones.has(p)) score += CONTACT_PHONE_WEIGHT;
  score += jaccardSimilarity(a.words, b.words) * TEXT_JACCARD_WEIGHT;
  return score;
}

function mergeLabelsFromSupplemental(entities: SupplementalEntity[]): Set<string> {
  const s = new Set<string>();
  for (const e of entities) {
    const n = normLabel(e.label);
    if (n) s.add(n);
  }
  return s;
}

/**
 * Loads per-file extracted text and normalized entity labels (from DB) for the case,
 * then merges this run's supplemental entities into the source evidence profile.
 */
export async function loadEvidenceContentProfiles(
  supabase: AppSupabaseClient,
  caseId: string,
  sourceEvidenceId: string,
  supplementalEntities: SupplementalEntity[],
): Promise<Map<string, EvidenceContentProfile>> {
  const { data: files, error: fErr } = await supabase
    .from("evidence_files")
    .select("id, original_filename")
    .eq("case_id", caseId);
  if (fErr) throw new Error(fErr.message);
  const ids = (files ?? []).map((r) => r.id as string);
  if (ids.length === 0) return new Map();

  const { data: texts, error: tErr } = await supabase
    .from("extracted_texts")
    .select("evidence_file_id, raw_text")
    .in("evidence_file_id", ids);
  if (tErr) throw new Error(tErr.message);
  const textById = Object.fromEntries(
    (texts ?? []).map((r) => [r.evidence_file_id as string, (r.raw_text as string) ?? ""]),
  );

  const { data: caseEntities, error: ceErr } = await supabase
    .from("entities")
    .select("id, label")
    .eq("case_id", caseId);
  if (ceErr) throw new Error(ceErr.message);
  const entityIds = (caseEntities ?? []).map((r) => r.id as string);
  const labelByEntityId = Object.fromEntries(
    (caseEntities ?? []).map((r) => [r.id as string, normLabel(r.label as string)]),
  );

  const labelsByEvidence = new Map<string, Set<string>>();
  if (entityIds.length > 0) {
    const { data: mentions, error: mErr } = await supabase
      .from("entity_mentions")
      .select("evidence_file_id, entity_id")
      .in("entity_id", entityIds);
    if (mErr) throw new Error(mErr.message);
    for (const row of mentions ?? []) {
      const eid = row.evidence_file_id as string;
      const lab = labelByEntityId[row.entity_id as string];
      if (!lab) continue;
      if (!labelsByEvidence.has(eid)) labelsByEvidence.set(eid, new Set());
      labelsByEvidence.get(eid)!.add(lab);
    }
  }

  const profiles = new Map<string, EvidenceContentProfile>();
  for (const f of files ?? []) {
    const id = f.id as string;
    const raw = textById[id] ?? "";
    const labels = labelsByEvidence.get(id) ?? new Set<string>();
    if (id === sourceEvidenceId) {
      for (const x of mergeLabelsFromSupplemental(supplementalEntities)) labels.add(x);
    }
    profiles.set(id, {
      id,
      filename: f.original_filename as string,
      entityLabels: labels,
      emails: extractEmails(raw),
      phones: extractPhones(raw),
      words: significantWords(raw),
    });
  }
  return profiles;
}

function filenameHintMatches(profile: EvidenceContentProfile, hint: string): boolean {
  const h = basenameOnly(hint).toLowerCase();
  const fn = basenameOnly(profile.filename).toLowerCase();
  if (!h) return false;
  return fn === h || fn.includes(h) || h.includes(fn);
}

export type CrossEvidenceResolver = {
  /** Resolve a model hint (often a filename string) to a target evidence id using content + optional metadata. */
  resolveFilenameOrHint: (hint: string | undefined | null) => string | undefined;
  /** Pairwise link when hint is empty: use description + entity overlap. */
  resolveInferredLinkTarget: (description: string | undefined) => string | undefined;
  /** Extra cluster members beyond hints — same people/places/contacts as source or hinted files. */
  expandClusterMembers: (
    hintedIds: string[],
    clusterText: string,
    minScore?: number,
  ) => string[];
};

export function createCrossEvidenceResolver(
  sourceEvidenceId: string,
  profiles: Map<string, EvidenceContentProfile>,
  options?: { minLink?: number; minCluster?: number },
): CrossEvidenceResolver {
  const minLink = options?.minLink ?? MIN_SCORE_INFERRED_LINK;
  const minCluster = options?.minCluster ?? MIN_SCORE_CLUSTER_MEMBER;
  const source = profiles.get(sourceEvidenceId);
  if (!source) {
    return {
      resolveFilenameOrHint: () => undefined,
      resolveInferredLinkTarget: () => undefined,
      expandClusterMembers: () => [],
    };
  }

  const others = [...profiles.keys()].filter((id) => id !== sourceEvidenceId);

  return {
    resolveFilenameOrHint(hint) {
      const trimmed = hint?.trim() ?? "";
      const candidates: { id: string; score: number }[] = [];
      for (const oid of others) {
        const p = profiles.get(oid)!;
        let score = scoreContentAffinity(source, p);
        if (trimmed && filenameHintMatches(p, trimmed)) score += FILENAME_HINT_BOOST;
        candidates.push({ id: oid, score });
      }
      if (trimmed) {
        const exact = others.filter((oid) => filenameHintMatches(profiles.get(oid)!, trimmed));
        if (exact.length === 1) {
          return exact[0] === sourceEvidenceId ? undefined : exact[0];
        }
        if (exact.length > 1) {
          const pool = candidates.filter((c) => exact.includes(c.id));
          pool.sort((a, b) => b.score - a.score);
          const top = pool[0];
          if (top && top.score >= minLink) return top.id;
        }
      }
      candidates.sort((a, b) => b.score - a.score);
      const top = candidates[0];
      if (!top || top.score < minLink) return undefined;
      return top.id;
    },

    resolveInferredLinkTarget(description) {
      const desc = description?.trim() ?? "";
      const descWords = significantWords(desc);
      let best: { id: string; score: number } | undefined;
      for (const oid of others) {
        const p = profiles.get(oid)!;
        let score = scoreContentAffinity(source, p);
        if (descWords.size) {
          score += jaccardSimilarity(descWords, p.words) * TEXT_JACCARD_WEIGHT;
          for (const lab of p.entityLabels) {
            if (desc.toLowerCase().includes(lab)) score += ENTITY_MATCH_WEIGHT * 0.5;
          }
        }
        if (!best || score > best.score) best = { id: oid, score };
      }
      return best && best.score >= minLink ? best.id : undefined;
    },

    expandClusterMembers(hintedIds, clusterText, threshold = minCluster) {
      const seeds = new Set<string>([sourceEvidenceId, ...hintedIds]);
      const clusterWords = significantWords(clusterText);
      const extra: string[] = [];
      for (const oid of others) {
        if (seeds.has(oid)) continue;
        const p = profiles.get(oid)!;
        let score = 0;
        for (const hid of hintedIds) {
          const hp = profiles.get(hid);
          if (hp) score = Math.max(score, scoreContentAffinity(p, hp));
        }
        score = Math.max(score, scoreContentAffinity(source, p));
        if (clusterWords.size) {
          score += jaccardSimilarity(clusterWords, p.words) * (TEXT_JACCARD_WEIGHT * 0.5);
        }
        if (score >= threshold) extra.push(oid);
      }
      return extra;
    },
  };
}

/** @deprecated Filename-only resolution; kept for narrow compatibility checks. */
export async function resolveFilenamesToEvidenceIdsExact(
  supabase: AppSupabaseClient,
  caseId: string,
  filenames: string[],
): Promise<Map<string, string>> {
  const uniq = [...new Set(filenames.map((f) => f.trim()).filter(Boolean))];
  const map = new Map<string, string>();
  if (uniq.length === 0) return map;
  const { data, error } = await supabase
    .from("evidence_files")
    .select("id, original_filename")
    .eq("case_id", caseId)
    .in("original_filename", uniq);
  if (error) throw new Error(error.message);
  for (const row of data ?? []) {
    map.set(row.original_filename as string, row.id as string);
  }
  return map;
}
