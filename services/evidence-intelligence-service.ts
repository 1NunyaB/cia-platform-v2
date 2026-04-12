import type { AppSupabaseClient } from "@/types";
import type { StructuredFinding } from "@/types/analysis";
import type {
  ClusterAdvisoryTier,
  ClusterSuggestion,
  EvidenceCollaborationSnapshot,
  EvidenceIntelligenceResult,
} from "@/types/evidence-intelligence";
import { logActivity } from "@/services/activity-service";
import {
  listEvidenceClustersForCase,
  listEvidenceLinksForEvidence,
  type EvidenceClusterRow,
} from "@/services/case-investigation-query";
import { getExtractedText } from "@/services/evidence-service";
import { normalizeStructuredFinding } from "@/lib/schemas/structured-finding";
import { enforceFindingDiscipline } from "@/services/analysis-finding-validation";
import { fetchProfilesByIds } from "@/lib/profiles";
import {
  CLUSTER_AUTO_LINK_MIN_SIGNALS,
  CLUSTER_AUTO_LINK_SCORE_THRESHOLD,
  CLUSTER_MENTION_SCORE_THRESHOLD,
  CLUSTER_RECOMMEND_SCORE_THRESHOLD,
} from "@/lib/evidence-intelligence-thresholds";

export {
  CLUSTER_AUTO_LINK_MIN_SIGNALS,
  CLUSTER_AUTO_LINK_SCORE_THRESHOLD,
  CLUSTER_MENTION_SCORE_THRESHOLD,
  CLUSTER_RECOMMEND_SCORE_THRESHOLD,
} from "@/lib/evidence-intelligence-thresholds";

/** Clustering uses text overlap only — it does not verify identity (see prompts/investigation-analysis.ts). */

const TEXT_CHUNK = 6000;

function tokenize(s: string): Set<string> {
  const out = new Set<string>();
  const lower = s.toLowerCase();
  for (const w of lower.split(/\W+/)) {
    if (w.length > 3) out.add(w);
  }
  return out;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) {
    if (b.has(x)) inter++;
  }
  const union = a.size + b.size - inter;
  return union ? inter / union : 0;
}

async function loadEntityIdsForEvidence(
  supabase: AppSupabaseClient,
  caseId: string,
  evidenceId: string,
): Promise<Set<string>> {
  const ids = new Set<string>();

  const { data: direct } = await supabase
    .from("entities")
    .select("id")
    .eq("case_id", caseId)
    .eq("evidence_file_id", evidenceId);

  for (const r of direct ?? []) ids.add(r.id as string);

  const { data: mentions } = await supabase
    .from("entity_mentions")
    .select("entity_id")
    .eq("evidence_file_id", evidenceId);

  for (const r of mentions ?? []) ids.add(r.entity_id as string);

  return ids;
}

async function loadEntityLabels(
  supabase: AppSupabaseClient,
  entityIds: string[],
): Promise<Map<string, string>> {
  if (entityIds.length === 0) return new Map();
  const { data, error } = await supabase.from("entities").select("id, label").in("id", entityIds);
  if (error) throw new Error(error.message);
  const m = new Map<string, string>();
  for (const r of data ?? []) m.set(r.id as string, r.label as string);
  return m;
}

/** Batch-load entity id sets per evidence file (mentions + direct entity rows). */
async function loadEntityIdsForEvidenceBatch(
  supabase: AppSupabaseClient,
  caseId: string,
  evidenceIds: string[],
): Promise<Map<string, Set<string>>> {
  const map = new Map<string, Set<string>>();
  for (const id of evidenceIds) map.set(id, new Set());
  if (evidenceIds.length === 0) return map;

  const { data: direct, error: dErr } = await supabase
    .from("entities")
    .select("id, evidence_file_id")
    .eq("case_id", caseId)
    .in("evidence_file_id", evidenceIds);
  if (dErr) throw new Error(dErr.message);
  for (const r of direct ?? []) {
    const fid = r.evidence_file_id as string;
    map.get(fid)?.add(r.id as string);
  }

  const { data: mentions, error: mErr } = await supabase
    .from("entity_mentions")
    .select("entity_id, evidence_file_id")
    .in("evidence_file_id", evidenceIds);
  if (mErr) throw new Error(mErr.message);
  for (const r of mentions ?? []) {
    const fid = r.evidence_file_id as string;
    map.get(fid)?.add(r.entity_id as string);
  }

  return map;
}

/** Signals weighted entity overlap > explicit links > lexical Jaccard (aligns with platform search/correlation priority). */
function countOverlapSignals(
  extracted: string,
  cluster: EvidenceClusterRow,
  memberIds: string[],
  entityByEvidence: Map<string, Set<string>>,
  labelByEntity: Map<string, string>,
  thisEntityIds: Set<string>,
  linkTargets: Set<string>,
): {
  score: number;
  sharedEntityLabels: string[];
  linkCount: number;
  textJ: number;
  dimensions: number;
} {
  const clusterEntityIds = new Set<string>();
  for (const mid of memberIds) {
    const set = entityByEvidence.get(mid);
    if (!set) continue;
    for (const eid of set) clusterEntityIds.add(eid);
  }

  const sharedLabels: string[] = [];
  for (const id of thisEntityIds) {
    if (clusterEntityIds.has(id)) {
      const lab = labelByEntity.get(id);
      if (lab) sharedLabels.push(lab);
    }
  }

  let linkCount = 0;
  for (const m of memberIds) {
    if (linkTargets.has(m)) linkCount++;
  }

  const clusterTextParts: string[] = [];
  if (cluster.rationale) clusterTextParts.push(cluster.rationale);
  if (cluster.title) clusterTextParts.push(cluster.title);
  for (const mem of cluster.evidence_cluster_members ?? []) {
    const fn = mem.evidence_files?.original_filename;
    if (fn) clusterTextParts.push(fn);
  }
  const clusterCorpus = clusterTextParts.join("\n").slice(0, TEXT_CHUNK);
  const extractChunk = extracted.slice(0, TEXT_CHUNK);
  const textJ = jaccard(tokenize(extractChunk), tokenize(clusterCorpus));

  const entityScore = sharedLabels.length ? Math.min(1, sharedLabels.length / 4) : 0;
  const linkScore = Math.min(1, linkCount / 2);
  const combined = 0.48 * entityScore + 0.34 * linkScore + 0.18 * textJ;

  let dimensions = 0;
  if (sharedLabels.length > 0) dimensions++;
  if (linkCount > 0) dimensions++;
  if (textJ >= 0.08) dimensions++;

  return {
    score: Math.min(1, combined),
    sharedEntityLabels: [...new Set(sharedLabels)].slice(0, 8),
    linkCount,
    textJ,
    dimensions,
  };
}

function tierFromScore(score: number): ClusterAdvisoryTier {
  if (score >= CLUSTER_RECOMMEND_SCORE_THRESHOLD) {
    if (score >= CLUSTER_AUTO_LINK_SCORE_THRESHOLD - 0.06) return "high";
    return "medium";
  }
  if (score >= CLUSTER_MENTION_SCORE_THRESHOLD) return "low";
  return "low";
}

function shouldAutoLink(score: number, dimensions: number, sharedEntityLabels: string[], linkCount: number): boolean {
  if (score < CLUSTER_AUTO_LINK_SCORE_THRESHOLD) return false;
  let signals = 0;
  if (sharedEntityLabels.length > 0) signals++;
  if (linkCount > 0) signals++;
  if (dimensions >= 2) signals++;
  return signals >= CLUSTER_AUTO_LINK_MIN_SIGNALS;
}

function buildFinding(
  input: {
    existing: { id: string; title: string | null }[];
    suggestions: ClusterSuggestion[];
    autoLinked: EvidenceIntelligenceResult["autoLinked"];
    collab: EvidenceCollaborationSnapshot;
    crossLinks: number;
  },
): StructuredFinding {
  const { collab, crossLinks } = input;
  const lines: string[] = [];
  lines.push(
    `Collaboration: ${collab.openEventCount} open event(s) recorded for this file; ${collab.distinctViewerCount} distinct viewer(s). ` +
      `Sticky notes: ${collab.hasStickies ? "yes" : "no"}; comments: ${collab.hasComments ? "yes" : "no"}; formal notes: ${collab.hasFormalNotes ? "yes" : "no"}. ` +
      `Case entities tied to this extract: ${collab.entityMentionCount}; timeline links: ${collab.timelineEventLinkCount}; cross-evidence links: ${crossLinks}.`,
  );
  if (input.existing.length) {
    lines.push(`Already linked clusters: ${input.existing.map((c) => c.title ?? c.id).join("; ")}.`);
  }
  if (input.autoLinked.length) {
    lines.push(
      `Automatic cluster placement (high-confidence overlap): ${input.autoLinked.map((a) => a.title ?? a.clusterId).join("; ")}.`,
    );
  }
  const rec = input.suggestions.filter((s) => !s.autoLinked && s.tier !== "low");
  const leads = input.suggestions.filter((s) => s.tier === "low" && !s.autoLinked);
  if (rec.length) {
    lines.push(
      `Suggested additional linkage (review recommended): ${rec.map((s) => `${s.title ?? "Cluster"} (${(s.score * 100).toFixed(0)}%)`).join("; ")}.`,
    );
  }
  if (leads.length) {
    lines.push(`Possible weak leads (low score): ${leads.map((s) => s.title ?? s.clusterId).join("; ")}.`);
  }

  const evidence_basis = [
    `Activity and collaboration counts are from case activity_log (opens), comments, notes, and sticky tables.`,
    `Ranking intent: shared entity labels and explicit cross-evidence links are weighted above raw lexical overlap (combined score uses entity > link > token Jaccard — see service).`,
    `Entity overlap uses case entity graph (entities + entity_mentions) compared to other files in each cluster.`,
    `Cross-evidence links use evidence_links for this case (document-to-document relationships).`,
    `Lexical overlap uses token overlap between this file’s extracted text and each cluster’s title, rationale, and member filenames (Jaccard on word tokens; not semantic similarity).`,
    `Phone-like digit runs and email-shaped tokens are only supporting cues when they co-occur with cluster text or entity matches.`,
    `Thresholds: auto-link ≥ ${CLUSTER_AUTO_LINK_SCORE_THRESHOLD} with ≥ ${CLUSTER_AUTO_LINK_MIN_SIGNALS} corroborating signals; recommend ≥ ${CLUSTER_RECOMMEND_SCORE_THRESHOLD}; mention ≥ ${CLUSTER_MENTION_SCORE_THRESHOLD}.`,
  ].join(" ");

  const reasoning = [
    "The platform correlates files when the same person or organization labels appear on this extract and on other items already grouped, when explicit cross-evidence links exist to cluster members, or when shared words across text and cluster metadata suggest the same subject matter.",
    "Dates, street or city references, and email-shaped strings in the extract are treated as additional overlap cues only when they also align with cluster text or linked files; this pass does not claim image EXIF or external enrichment unless present in stored text.",
  ].join(" ");

  const limitations = [
    "This pass is heuristic (overlap and links), not a full re-run of the AI analysis model.",
    "Correlation is not proof: strong entity or link overlap still requires human review of the underlying text.",
    "High scores can still reflect coincidence; review cluster rationale before treating linkage as proof.",
    "Auto-link only fires when score and independent signals both clear configured thresholds.",
  ].join(" ");

  const next_step = [
    "Review suggested clusters in the advisory list; open each cluster on the case page to validate shared facts.",
    "If extraction is thin, add OCR or richer text, then re-open this file so overlap signals strengthen.",
    "Confirm or remove automatic memberships if the shared wording does not reflect the same real-world event.",
  ].join(" ");

  const raw: StructuredFinding = normalizeStructuredFinding({
    finding_answer: lines.join(" "),
    evidence_basis,
    confidence: "medium",
    classification: "Correlated",
    reasoning,
    limitations,
    next_step,
  });

  return enforceFindingDiscipline(raw, { scope: "evidence_file" });
}

/**
 * Records the evidence view, evaluates clusters/entities/links, optionally auto-adds high-confidence
 * cluster memberships, logs auto-link events, and returns a structured advisory for the UI.
 * Cluster overlap and suggestions do not assess per-file authenticity (`authenticity_label`); that comes from structured analysis.
 */
export async function runEvidenceIntelligenceOnOpen(
  supabase: AppSupabaseClient,
  input: { caseId: string | null; evidenceId: string; userId: string | null },
): Promise<EvidenceIntelligenceResult> {
  const { caseId, evidenceId, userId } = input;

  try {
    await logActivity(supabase, {
      caseId,
      actorId: userId,
      actorLabel: userId ? "Analyst" : null,
      action: "evidence.opened",
      entityType: "evidence_file",
      entityId: evidenceId,
      payload: { source: "evidence_intelligence" },
    });
  } catch (e) {
    console.warn("[evidence-intelligence] log open failed:", e);
  }

  if (!caseId) {
    const collab: EvidenceCollaborationSnapshot = {
      openEventCount: 0,
      distinctViewerCount: 0,
      viewerNames: [],
      hasStickies: false,
      hasComments: false,
      hasFormalNotes: false,
      entityMentionCount: 0,
      timelineEventLinkCount: 0,
      crossEvidenceLinkCount: 0,
    };
    const finding = buildFinding({
      existing: [],
      suggestions: [],
      autoLinked: [],
      collab,
      crossLinks: 0,
    });
    return {
      finding,
      existingClusters: [],
      suggestions: [],
      autoLinked: [],
      collaboration: collab,
    };
  }

  const [
    extractedRow,
    crossRows,
    clusters,
    thisEntityIds,
    stickyCount,
    commentCount,
    noteCount,
    timelineCount,
    openQuery,
  ] = await Promise.all([
    getExtractedText(supabase, evidenceId),
    listEvidenceLinksForEvidence(supabase, caseId, evidenceId),
    listEvidenceClustersForCase(supabase, caseId),
    loadEntityIdsForEvidence(supabase, caseId, evidenceId),
    supabase
      .from("evidence_sticky_notes")
      .select("id", { count: "exact", head: true })
      .eq("evidence_file_id", evidenceId)
      .then(({ count }) => count ?? 0),
    supabase
      .from("comments")
      .select("id", { count: "exact", head: true })
      .eq("case_id", caseId)
      .eq("evidence_file_id", evidenceId)
      .then(({ count }) => count ?? 0),
    supabase
      .from("notes")
      .select("id", { count: "exact", head: true })
      .eq("case_id", caseId)
      .eq("evidence_file_id", evidenceId)
      .then(({ count }) => count ?? 0),
    supabase
      .from("timeline_event_evidence")
      .select("timeline_event_id", { count: "exact", head: true })
      .eq("evidence_file_id", evidenceId)
      .then(({ count }) => count ?? 0),
    supabase
      .from("activity_log")
      .select("id, actor_id, actor_label, created_at")
      .eq("case_id", caseId)
      .eq("action", "evidence.opened")
      .eq("entity_id", evidenceId)
      .order("created_at", { ascending: false }),
  ]);

  const opens = openQuery.data ?? [];

  const extractedText = (extractedRow?.raw_text as string) ?? "";

  const linkTargets = new Set(crossRows.map((x) => x.otherId));

  const existingClusters = clusters.filter((cl) =>
    (cl.evidence_cluster_members ?? []).some((m) => m.evidence_file_id === evidenceId),
  );

  const memberEvidenceIds = new Set<string>();
  for (const cl of clusters) {
    for (const m of cl.evidence_cluster_members ?? []) {
      const eid = m.evidence_file_id as string;
      if (eid !== evidenceId) memberEvidenceIds.add(eid);
    }
  }
  memberEvidenceIds.add(evidenceId);

  const entityByEvidence = await loadEntityIdsForEvidenceBatch(supabase, caseId, [...memberEvidenceIds]);
  const allLabelEntityIds = new Set<string>(thisEntityIds);
  for (const eid of memberEvidenceIds) {
    for (const x of entityByEvidence.get(eid) ?? []) allLabelEntityIds.add(x);
  }
  const labelByEntity = await loadEntityLabels(supabase, [...allLabelEntityIds]);

  const suggestions: ClusterSuggestion[] = [];
  const autoLinked: EvidenceIntelligenceResult["autoLinked"] = [];

  for (const cl of clusters) {
    const memberIds = (cl.evidence_cluster_members ?? [])
      .map((m) => m.evidence_file_id as string)
      .filter((id) => id !== evidenceId);

    const already = (cl.evidence_cluster_members ?? []).some((m) => m.evidence_file_id === evidenceId);
    if (already) continue;

    if (memberIds.length === 0) continue;

    const { score, sharedEntityLabels, linkCount, textJ, dimensions } = countOverlapSignals(
      extractedText,
      cl,
      memberIds,
      entityByEvidence,
      labelByEntity,
      thisEntityIds,
      linkTargets,
    );

    if (score < CLUSTER_MENTION_SCORE_THRESHOLD) continue;

    const tier = tierFromScore(score);
    const reasons: string[] = [];
    if (sharedEntityLabels.length) {
      reasons.push(
        `Same case entity label(s) appear on this file and on cluster member(s): ${sharedEntityLabels.slice(0, 5).join(", ")}.`,
      );
    }
    if (linkCount > 0) {
      reasons.push(`${linkCount} cross-evidence link(s) connect this file to item(s) in this cluster.`);
    }
    if (textJ >= 0.08) {
      reasons.push(
        `Lexical overlap between this extract and cluster text/filenames is ${(textJ * 100).toFixed(0)}% (token Jaccard; same topic cue, not proof).`,
      );
    }
    const dateCue = /\b20\d{2}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/.test(extractedText);
    const emailCue = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(extractedText);
    if (dateCue || emailCue) {
      reasons.push(
        `Extract contains date-like or email-like tokens; overlap with cluster metadata increases correlation only when tokens also match cluster text (see limitations).`,
      );
    }
    if (reasons.length === 0) {
      reasons.push("Weak overlap signal only; treat as a lead.");
    }

    const auto = shouldAutoLink(score, dimensions, sharedEntityLabels, linkCount);

    suggestions.push({
      clusterId: cl.id,
      title: cl.title,
      rationale: cl.rationale,
      score,
      tier,
      reasons,
      autoLinked: false,
    });

    if (auto) {
      const { error: insErr } = await supabase.from("evidence_cluster_members").insert({
        cluster_id: cl.id,
        evidence_file_id: evidenceId,
      });
      if (!insErr) {
        suggestions[suggestions.length - 1]!.autoLinked = true;
        autoLinked.push({
          clusterId: cl.id,
          title: cl.title,
          score,
          rationale: reasons.join(" "),
        });
        try {
          await logActivity(supabase, {
            caseId,
            actorId: null,
            actorLabel: "System",
            action: "evidence.cluster_auto_linked",
            entityType: "evidence_cluster",
            entityId: cl.id,
            payload: {
              evidence_file_id: evidenceId,
              score,
              thresholds: {
                auto: CLUSTER_AUTO_LINK_SCORE_THRESHOLD,
                minSignals: CLUSTER_AUTO_LINK_MIN_SIGNALS,
              },
              rationale: reasons.slice(0, 3),
            },
          });
        } catch (e) {
          console.warn("[evidence-intelligence] auto-link log failed:", e);
        }
      } else if (insErr.code !== "23505") {
        console.warn("[evidence-intelligence] cluster member insert:", insErr.message);
      }
    }
  }

  suggestions.sort((a, b) => b.score - a.score);

  const actorIds = [...new Set(opens.map((o) => o.actor_id).filter(Boolean))] as string[];
  const profiles = actorIds.length ? await fetchProfilesByIds(supabase, actorIds) : {};
  const viewerNames = actorIds.map((id) => profiles[id]?.display_name ?? id);
  const distinctViewerKeys = new Set(
    opens.map((o) => (o.actor_id ? `id:${o.actor_id}` : `lbl:${o.actor_label ?? "?"}`)),
  );

  const collab: EvidenceCollaborationSnapshot = {
    openEventCount: opens.length,
    distinctViewerCount: distinctViewerKeys.size,
    viewerNames,
    hasStickies: stickyCount > 0,
    hasComments: commentCount > 0,
    hasFormalNotes: noteCount > 0,
    entityMentionCount: thisEntityIds.size,
    timelineEventLinkCount: timelineCount,
    crossEvidenceLinkCount: crossRows.length,
  };

  const mergedExistingMap = new Map<string, { id: string; title: string | null; rationale: string | null }>();
  for (const c of existingClusters) {
    mergedExistingMap.set(c.id, { id: c.id, title: c.title, rationale: c.rationale });
  }
  for (const a of autoLinked) {
    if (!mergedExistingMap.has(a.clusterId)) {
      mergedExistingMap.set(a.clusterId, {
        id: a.clusterId,
        title: a.title,
        rationale: null,
      });
    }
  }
  const mergedExisting = [...mergedExistingMap.values()];

  const finding = buildFinding({
    existing: mergedExisting,
    suggestions,
    autoLinked,
    collab,
    crossLinks: crossRows.length,
  });

  return {
    finding,
    existingClusters: mergedExisting,
    suggestions,
    autoLinked,
    collaboration: collab,
  };
}
