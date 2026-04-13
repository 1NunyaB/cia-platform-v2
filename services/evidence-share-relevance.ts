/**
 * Ranks investigations for in-app evidence linking using existing case index metadata.
 */
import type { AppSupabaseClient } from "@/types";
import { getCaseIndexSnapshot, type CaseIndexSnapshot } from "@/services/case-index-service";
import { getEvidenceById, getExtractedText } from "@/services/evidence-service";
import { listCasesForUser } from "@/services/case-service";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";
import { isExtractionPlaceholderText } from "@/lib/extraction-messages";
import { SHARE_RELEVANCE_STRONG_MIN } from "@/lib/evidence-share-relevance-constants";

export { SHARE_RELEVANCE_STRONG_MIN };

function tokenize(s: string): Set<string> {
  const out = new Set<string>();
  const lower = s.toLowerCase();
  for (const t of lower.split(/[^a-z0-9]+/)) {
    if (t.length >= 3) out.add(t);
  }
  return out;
}

function yearsInText(s: string): Set<string> {
  const y = new Set<string>();
  const re = /\b(19|20)\d{2}\b/g;
  let m;
  while ((m = re.exec(s))) y.add(m[0]!);
  return y;
}

type EvidenceSignals = {
  tokens: Set<string>;
  years: Set<string>;
  sourcePlatform: string;
  sourceProgram: string;
  usableExtract: string;
  label: string;
  originalFilename: string;
};

async function gatherEvidenceSignals(
  supabase: AppSupabaseClient,
  evidenceId: string,
): Promise<EvidenceSignals | null> {
  const ev = await getEvidenceById(supabase, evidenceId);
  if (!ev) return null;

  const extract = await getExtractedText(supabase, evidenceId);
  const raw = extract?.raw_text ? String(extract.raw_text).slice(0, 12000) : "";
  const usableExtract =
    raw.length > 0 && !isExtractionPlaceholderText(raw) ? raw.slice(0, 8000) : "";

  const label = evidencePrimaryLabel({
    display_filename: ev.display_filename ?? null,
    original_filename: ev.original_filename as string,
  });

  const tokens = new Set<string>();
  for (const part of [
    label,
    ev.original_filename as string,
    (ev.short_alias as string) ?? "",
    (ev.source_platform as string) ?? "",
    (ev.source_program as string) ?? "",
    String(ev.source_type ?? ""),
    usableExtract,
  ]) {
    for (const t of tokenize(part)) tokens.add(t);
  }

  const years = yearsInText(usableExtract + label + String(ev.original_filename ?? ""));

  return {
    tokens,
    years,
    sourcePlatform: String(ev.source_platform ?? "").toLowerCase(),
    sourceProgram: String(ev.source_program ?? "").toLowerCase(),
    usableExtract,
    label,
    originalFilename: String(ev.original_filename ?? ""),
  };
}

export function scoreSignalsAgainstCaseSnapshot(
  sig: EvidenceSignals,
  caseTitle: string,
  caseDescription: string | null,
  snap: CaseIndexSnapshot,
): { score: number; signals: string[] } {
  let score = 0;
  const signals: string[] = [];

  const titleTok = tokenize(`${caseTitle} ${caseDescription ?? ""}`);
  let inter = 0;
  for (const t of titleTok) {
    if (sig.tokens.has(t)) inter += 1;
  }
  const union = new Set([...titleTok, ...sig.tokens]).size;
  if (union > 0 && inter > 0) {
    const pts = Math.round((inter / union) * 45);
    score += pts;
    if (pts >= 8) {
      signals.push("Investigation title or scope overlaps names, source fields, or extracted text");
    }
  }

  const entityLabels = [...snap.accusers, ...snap.victims, ...snap.locations].map((b) => b.label);
  let entHits = 0;
  const hay = `${sig.usableExtract} ${sig.label} ${sig.originalFilename}`.toLowerCase();
  for (const lab of entityLabels) {
    const lt = lab.trim().toLowerCase();
    if (lt.length < 2) continue;
    if (hay.includes(lt)) entHits += 1;
  }
  if (entHits > 0) {
    score += Math.min(35, 12 + entHits * 8);
    signals.push(`${entHits} entit${entHits === 1 ? "y" : "ies"} in the target case match this file or extract`);
  }

  let aliasHits = 0;
  for (const al of snap.aliases) {
    const ad = al.aliasDisplay.trim().toLowerCase();
    if (ad.length < 3) continue;
    if (sig.tokens.has(ad) || sig.usableExtract.toLowerCase().includes(ad)) aliasHits += 1;
  }
  if (aliasHits > 0) {
    score += Math.min(20, 5 + aliasHits * 5);
    signals.push("Alias overlap with the target case index");
  }

  for (const yb of snap.years) {
    const year = yb.key.match(/\d{4}/)?.[0];
    if (year && sig.years.has(year)) {
      score += 18;
      signals.push(`Year ${year} appears in this file and the target timeline index`);
      break;
    }
  }

  for (const cl of snap.clusters) {
    const ct = tokenize(cl.title);
    let hit = false;
    for (const t of ct) {
      if (sig.tokens.has(t)) hit = true;
    }
    if (hit) {
      score += 12;
      signals.push("Cluster label overlap with file / extract tokens");
      break;
    }
  }

  for (const src of snap.sources) {
    const blob = [src.platform, src.program, src.label].filter(Boolean).join(" ").toLowerCase();
    if (!blob) continue;
    if (
      (sig.sourcePlatform && blob.includes(sig.sourcePlatform)) ||
      (sig.sourceProgram && blob.includes(sig.sourceProgram))
    ) {
      score += 14;
      signals.push("Source metadata similar to evidence already indexed in the target case");
      break;
    }
  }

  for (const item of snap.evidenceItems) {
    const it = tokenize(`${item.displayFilename} ${item.shortAlias} ${item.originalFilename}`);
    let ii = 0;
    for (const t of it) {
      if (sig.tokens.has(t)) ii += 1;
    }
    if (ii >= 2) {
      score += 10;
      signals.push("Naming pattern similar to other files in the target case");
      break;
    }
  }

  return { score: Math.min(100, score), signals: [...new Set(signals)] };
}

export type ShareCandidate = {
  caseId: string;
  title: string;
  score: number;
  signals: string[];
  strong: boolean;
};

export async function scoreEvidenceAgainstCase(
  supabase: AppSupabaseClient,
  evidenceId: string,
  targetCaseId: string,
): Promise<{ score: number; signals: string[]; strong: boolean } | null> {
  const sig = await gatherEvidenceSignals(supabase, evidenceId);
  if (!sig) return null;

  const { data: caseRow } = await supabase
    .from("cases")
    .select("title, description")
    .eq("id", targetCaseId)
    .maybeSingle();
  if (!caseRow) return null;

  const snap = await getCaseIndexSnapshot(supabase, targetCaseId);
  const { score, signals } = scoreSignalsAgainstCaseSnapshot(
    sig,
    String(caseRow.title ?? ""),
    (caseRow.description as string | null) ?? null,
    snap,
  );
  const strong = score >= SHARE_RELEVANCE_STRONG_MIN;
  return { score, signals, strong };
}

export async function buildShareCandidates(
  supabase: AppSupabaseClient,
  opts: {
    evidenceId: string;
    userId: string;
    excludeCaseId: string;
  },
): Promise<ShareCandidate[]> {
  const ev = await getEvidenceById(supabase, opts.evidenceId);
  if (!ev || (ev.uploaded_by as string | null) !== opts.userId) return [];

  const sig = await gatherEvidenceSignals(supabase, opts.evidenceId);
  if (!sig) return [];

  const cases = await listCasesForUser(supabase, opts.userId);
  const { data: memberships } = await supabase
    .from("evidence_case_memberships")
    .select("case_id")
    .eq("evidence_file_id", opts.evidenceId);
  const linked = new Set((memberships ?? []).map((m) => m.case_id as string));

  const targets = cases.filter((c) => {
    const id = c.id as string;
    return id !== opts.excludeCaseId && !linked.has(id);
  });

  const out: ShareCandidate[] = [];

  for (const c of targets) {
    const caseId = c.id as string;
    const snap = await getCaseIndexSnapshot(supabase, caseId);
    const { score, signals } = scoreSignalsAgainstCaseSnapshot(
      sig,
      String(c.title ?? ""),
      (c.description as string | null) ?? null,
      snap,
    );
    const strong = score >= SHARE_RELEVANCE_STRONG_MIN;
    out.push({
      caseId,
      title: String(c.title ?? "Untitled"),
      score,
      signals,
      strong,
    });
  }

  out.sort((a, b) => b.score - a.score);
  return out;
}
