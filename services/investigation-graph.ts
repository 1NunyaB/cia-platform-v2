import type { AppSupabaseClient } from "@/types";
import type {
  AnalysisSupplemental,
  EvidenceClusterKind,
  StoredAnalysisStructuredV2,
  StructuredFinding,
} from "@/types/analysis";
import { normalizeEntityOrAliasKey } from "@/lib/alias-normalize";
import type { CrossEvidenceResolver } from "@/lib/cross-evidence-resolution";
import { normalizeCategoryToken } from "@/lib/investigation-categories";
import { normalizeTimelineKind } from "@/lib/timeline-kind-schema";
import { resolveTimelineTier } from "@/lib/timeline-tier";
import { normalizeAuthenticityLabel } from "@/lib/schemas/authenticity-schema";

/**
 * Remove graph artifacts for one evidence file before re-analysis.
 * Preserves case-canonical entities that still have mentions on other evidence.
 */
export async function clearInvestigationArtifactsForEvidence(
  supabase: AppSupabaseClient,
  evidenceId: string,
  caseId: string | null,
) {
  const { data: analyses } = await supabase
    .from("ai_analyses")
    .select("id")
    .eq("evidence_file_id", evidenceId);

  const analysisIds = (analyses ?? []).map((a) => a.id as string);

  if (analysisIds.length > 0) {
    await supabase.from("evidence_links").delete().in("ai_analysis_id", analysisIds);
    // Do not delete evidence_clusters by analysis id — clusters are case-level and shared.
    // Membership rows for this file are removed below; persistEvidenceClusters re-adds/merges.
  }

  await supabase.from("evidence_cluster_members").delete().eq("evidence_file_id", evidenceId);

  await supabase.from("timeline_event_evidence").delete().eq("evidence_file_id", evidenceId);

  const { data: timelines } = await supabase
    .from("timeline_events")
    .select("id")
    .eq("evidence_file_id", evidenceId);

  const timelineIds = (timelines ?? []).map((t) => t.id as string);
  if (timelineIds.length > 0) {
    await supabase.from("timeline_event_evidence").delete().in("timeline_event_id", timelineIds);
  }

  await supabase.from("timeline_events").delete().eq("evidence_file_id", evidenceId);
  await supabase.from("relationships").delete().eq("evidence_file_id", evidenceId);
  await supabase.from("entity_mentions").delete().eq("evidence_file_id", evidenceId);

  if (caseId) {
    const { data: candidates } = await supabase.from("entities").select("id").eq("case_id", caseId);

    for (const row of candidates ?? []) {
      const { count } = await supabase
        .from("entity_mentions")
        .select("id", { count: "exact", head: true })
        .eq("entity_id", row.id as string);
      if (count === 0) {
        await supabase.from("entity_categories").delete().eq("entity_id", row.id as string);
        await supabase.from("entities").delete().eq("id", row.id as string);
      }
    }
  }

  await supabase.from("ai_analyses").delete().eq("evidence_file_id", evidenceId);
}

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

/**
 * Upsert case-scoped entities by canonical label (unique index on case_id + lower(btrim(label))),
 * attach categories and mentions for this evidence file.
 */
export async function persistEntityGraph(
  supabase: AppSupabaseClient,
  input: {
    caseId: string;
    evidenceId: string;
    analysisId: string;
    supplemental: AnalysisSupplemental;
  },
): Promise<Map<string, string>> {
  const labelToId = new Map<string, string>();
  const { caseId, evidenceId, analysisId, supplemental } = input;

  const { data: existingEntities } = await supabase
    .from("entities")
    .select("id, label")
    .eq("case_id", caseId);

  const byNorm = new Map<string, string>();
  for (const e of existingEntities ?? []) {
    byNorm.set(normalizeLabel(e.label as string), e.id as string);
  }

  for (const ent of supplemental.entities) {
    const norm = normalizeLabel(ent.label);
    let entityId = byNorm.get(norm);

    if (!entityId) {
      const { data: inserted, error } = await supabase
        .from("entities")
        .insert({
          case_id: caseId,
          evidence_file_id: evidenceId,
          ai_analysis_id: analysisId,
          label: ent.label.trim(),
          entity_type: ent.entity_type,
          metadata: {},
        })
        .select("id")
        .single();

      if (error) {
        if (error.code === "23505") {
          const { data: row } = await supabase
            .from("entities")
            .select("id, label")
            .eq("case_id", caseId);
          const hit = (row ?? []).find((r) => normalizeLabel(r.label as string) === norm);
          entityId = hit?.id as string | undefined;
        }
        if (!entityId) throw new Error(error.message);
      } else if (inserted) {
        entityId = inserted.id as string;
      }
      if (entityId) byNorm.set(norm, entityId);
    } else {
      await supabase
        .from("entities")
        .update({ ai_analysis_id: analysisId, entity_type: ent.entity_type })
        .eq("id", entityId);
    }

    if (!entityId) continue;

    labelToId.set(ent.label.trim().toLowerCase(), entityId);

    for (const cat of ent.categories ?? []) {
      const slug = normalizeCategoryToken(cat);
      if (!slug) continue;
      const { error: catErr } = await supabase.from("entity_categories").insert({
        entity_id: entityId,
        category: slug,
      });
      if (catErr && catErr.code !== "23505") throw new Error(catErr.message);
    }

    for (const m of ent.mentions ?? []) {
      await supabase.from("entity_mentions").insert({
        entity_id: entityId,
        evidence_file_id: evidenceId,
        snippet: m.snippet,
      });
    }

    for (const al of ent.aliases ?? []) {
      const display = al.alias.trim();
      if (!display) continue;
      const norm = normalizeEntityOrAliasKey(display);
      const primaryNorm = normalizeEntityOrAliasKey(ent.label);
      if (norm === primaryNorm) continue;

      const strength = al.strength ?? "moderate";
      const { error: aliasErr } = await supabase.from("entity_aliases").upsert(
        {
          case_id: caseId,
          entity_id: entityId,
          alias_display: display,
          alias_normalized: norm,
          strength,
          source: "analysis",
          evidence_file_id: evidenceId,
          ai_analysis_id: analysisId,
        },
        { onConflict: "entity_id,alias_normalized" },
      );
      if (aliasErr) throw new Error(aliasErr.message);
    }
  }

  return labelToId;
}

function normalizeClusterTitleKey(title: string | null | undefined): string | null {
  const t = title?.trim().toLowerCase().replace(/\s+/g, " ") ?? "";
  return t.length ? t : null;
}

function mergeClusterRationale(existing: string | null | undefined, incoming: string | null | undefined): string | null {
  const a = (existing ?? "").trim();
  const b = (incoming ?? "").trim();
  if (!b) return a || null;
  if (!a) return b || null;
  if (b.length > a.length) return b;
  return a;
}

function normalizeClusterKindInput(k: string | null | undefined): EvidenceClusterKind {
  return k === "alias_focused" ? "alias_focused" : "standard";
}

function mergeClusterKinds(a: EvidenceClusterKind, b: EvidenceClusterKind): EvidenceClusterKind {
  return a === "alias_focused" || b === "alias_focused" ? "alias_focused" : "standard";
}

async function insertEvidenceClusterMember(
  supabase: AppSupabaseClient,
  clusterId: string,
  evidenceFileId: string,
  aliasFocused: boolean,
) {
  const payload: {
    cluster_id: string;
    evidence_file_id: string;
    link_source?: string;
  } = {
    cluster_id: clusterId,
    evidence_file_id: evidenceFileId,
  };
  if (aliasFocused) {
    payload.link_source = "alias_resolution";
  }
  const { error: mErr } = await supabase.from("evidence_cluster_members").insert(payload);
  if (mErr?.code === "23505") {
    if (aliasFocused) {
      const { error: uErr } = await supabase
        .from("evidence_cluster_members")
        .update({ link_source: "alias_resolution" })
        .eq("cluster_id", clusterId)
        .eq("evidence_file_id", evidenceFileId);
      if (uErr) throw new Error(uErr.message);
    }
    return;
  }
  if (mErr) throw new Error(mErr.message);
}

/**
 * Persists cluster membership for this analysis run. Reuses an existing case cluster when the
 * normalized title matches so the list stays shared and grows instead of duplicating per run/user.
 */
export async function persistEvidenceClusters(
  supabase: AppSupabaseClient,
  input: {
    caseId: string;
    evidenceId: string;
    analysisId: string;
    supplemental: AnalysisSupplemental;
    resolver: CrossEvidenceResolver;
  },
) {
  const { caseId, evidenceId, analysisId, supplemental, resolver } = input;

  const { data: existingClusters } = await supabase
    .from("evidence_clusters")
    .select("id, title, rationale, created_at, cluster_kind")
    .eq("case_id", caseId)
    .order("created_at", { ascending: true });

  /** Oldest cluster id per normalized title — canonical row for merges in this run + DB. */
  const canonicalIdByTitleKey = new Map<string, string>();
  const rationaleByClusterId = new Map<string, string | null>();
  const clusterKindById = new Map<string, EvidenceClusterKind>();

  for (const row of existingClusters ?? []) {
    const id = row.id as string;
    rationaleByClusterId.set(id, row.rationale as string | null);
    clusterKindById.set(id, normalizeClusterKindInput(row.cluster_kind as string | null));
    const key = normalizeClusterTitleKey(row.title as string | null);
    if (key && !canonicalIdByTitleKey.has(key)) {
      canonicalIdByTitleKey.set(key, id);
    }
  }

  for (const cl of supplemental.evidence_clusters ?? []) {
    const hintedIds: string[] = [];
    for (const fn of cl.evidence_filenames ?? []) {
      const id = resolver.resolveFilenameOrHint(fn);
      if (id) hintedIds.push(id);
    }
    const clusterText = `${cl.title ?? ""}\n${cl.rationale ?? ""}`;
    const expanded = resolver.expandClusterMembers(hintedIds, clusterText);
    const merged = [...new Set([...hintedIds, ...expanded, evidenceId])];
    if (merged.length < 2) continue;

    const titleKey = normalizeClusterTitleKey(cl.title ?? null);
    let clusterId: string | null = titleKey ? canonicalIdByTitleKey.get(titleKey) ?? null : null;

    const incomingKind = normalizeClusterKindInput(cl.cluster_kind);

    if (clusterId) {
      const prevRationale = rationaleByClusterId.get(clusterId) ?? null;
      const nextRationale = mergeClusterRationale(prevRationale, cl.rationale ?? null);
      const mergedKind = mergeClusterKinds(clusterKindById.get(clusterId) ?? "standard", incomingKind);
      const { error: upErr } = await supabase
        .from("evidence_clusters")
        .update({
          rationale: nextRationale,
          ai_analysis_id: analysisId,
          cluster_kind: mergedKind,
        })
        .eq("id", clusterId);
      if (upErr) throw new Error(upErr.message);
      rationaleByClusterId.set(clusterId, nextRationale);
      clusterKindById.set(clusterId, mergedKind);
    } else {
      const initialKind = mergeClusterKinds("standard", incomingKind);
      const { data: cluster, error } = await supabase
        .from("evidence_clusters")
        .insert({
          case_id: caseId,
          title: cl.title ?? null,
          rationale: cl.rationale ?? null,
          ai_analysis_id: analysisId,
          cluster_kind: initialKind,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);

      clusterId = cluster!.id as string;
      rationaleByClusterId.set(clusterId, cl.rationale ?? null);
      clusterKindById.set(clusterId, initialKind);
      if (titleKey) {
        canonicalIdByTitleKey.set(titleKey, clusterId);
      }
    }

    const aliasFocused = (clusterKindById.get(clusterId!) ?? "standard") === "alias_focused";

    for (const eid of merged) {
      await insertEvidenceClusterMember(supabase, clusterId!, eid, aliasFocused);
    }
  }
}

export async function persistEvidencePairLinks(
  supabase: AppSupabaseClient,
  input: {
    caseId: string;
    evidenceId: string;
    analysisId: string;
    supplemental: AnalysisSupplemental;
    resolver: CrossEvidenceResolver;
  },
) {
  const { caseId, evidenceId, analysisId, supplemental, resolver } = input;

  for (const link of supplemental.evidence_links ?? []) {
    const hint = link.target_evidence_filename?.trim() ?? "";
    let targetId: string | undefined;
    if (hint) targetId = resolver.resolveFilenameOrHint(hint);
    else if (link.description?.trim()) targetId = resolver.resolveInferredLinkTarget(link.description);
    else continue;
    if (!targetId || targetId === evidenceId) continue;

    const { error } = await supabase.from("evidence_links").insert({
      case_id: caseId,
      source_evidence_file_id: evidenceId,
      target_evidence_file_id: targetId,
      ai_analysis_id: analysisId,
      link_type: link.link_type ?? "related",
      description: link.description ?? null,
    });
    if (error && error.code !== "23505") throw new Error(error.message);
  }
}

export async function persistTimelineAndRelationships(
  supabase: AppSupabaseClient,
  input: {
    caseId: string;
    evidenceId: string;
    analysisId: string;
    supplemental: AnalysisSupplemental;
    labelToEntityId: Map<string, string>;
    resolver: CrossEvidenceResolver;
    finding: StructuredFinding;
    /** Same object as persisted `ai_analyses.structured` — timeline rows get `timeline_tier_resolved` attached. */
    structured?: StoredAnalysisStructuredV2;
  },
) {
  const { caseId, evidenceId, analysisId, supplemental, labelToEntityId, resolver, finding, structured } = input;

  for (const ev of supplemental.timeline) {
    let occurredAt: string | null = null;
    if (ev.occurred_at) {
      const d = new Date(ev.occurred_at);
      occurredAt = Number.isNaN(d.getTime()) ? null : d.toISOString();
    }

    const resolvedSupporting = (ev.supporting_evidence_filenames ?? [])
      .map((fn) => resolver.resolveFilenameOrHint(fn))
      .filter((id): id is string => Boolean(id));

    let tier = resolveTimelineTier({
      event: ev,
      findingClassification: finding.classification,
      originEvidenceId: evidenceId,
      resolvedSupportingEvidenceIds: resolvedSupporting,
    });
    /** Never Timeline 1 on weak finding confidence alone (multi-source rules still apply downstream). */
    if (finding.confidence === "low" && tier === "t1_confirmed") {
      tier = "t2_supported";
    }

    const kind = normalizeTimelineKind(ev.timeline_kind);
    const authenticityLabel = normalizeAuthenticityLabel(
      ev.authenticity_label ?? structured?.authenticity_label ?? "unverified",
    );
    Object.assign(ev, {
      timeline_tier_resolved: tier,
      timeline_kind_resolved: kind,
      authenticity_label: authenticityLabel,
    });

    const { data: te, error } = await supabase
      .from("timeline_events")
      .insert({
        case_id: caseId,
        evidence_file_id: evidenceId,
        ai_analysis_id: analysisId,
        occurred_at: occurredAt,
        title: ev.title,
        summary: ev.summary ?? null,
        timeline_tier: tier,
        timeline_kind: kind,
        source_label: ev.source_label?.trim() || null,
        event_classification: ev.event_classification?.trim() || null,
        event_reasoning: ev.event_reasoning?.trim() || null,
        event_limitations: ev.event_limitations?.trim() || null,
        contextual_time_inference: ev.contextual_time_inference
          ? (ev.contextual_time_inference as unknown as Record<string, unknown>)
          : null,
        authenticity_label: authenticityLabel,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const tid = te!.id as string;

    const { error: p0 } = await supabase.from("timeline_event_evidence").insert({
      timeline_event_id: tid,
      evidence_file_id: evidenceId,
      ai_analysis_id: analysisId,
      link_role: "primary",
    });
    if (p0 && p0.code !== "23505") throw new Error(p0.message);

    for (const fn of ev.supporting_evidence_filenames ?? []) {
      const eid = resolver.resolveFilenameOrHint(fn);
      if (!eid) continue;
      const { error: p1 } = await supabase.from("timeline_event_evidence").insert({
        timeline_event_id: tid,
        evidence_file_id: eid,
        ai_analysis_id: analysisId,
        link_role: "supporting",
      });
      if (p1 && p1.code !== "23505") throw new Error(p1.message);
    }
  }

  if (structured && supplemental.timeline.length > 0) {
    const { error: uErr } = await supabase
      .from("ai_analyses")
      .update({ structured: structured as unknown as Record<string, unknown> })
      .eq("id", analysisId);
    if (uErr) console.warn("[persistTimeline] structured update failed:", uErr.message);
  }

  for (const rel of supplemental.relationships) {
    const src = labelToEntityId.get(rel.source_label.trim().toLowerCase());
    const tgt = labelToEntityId.get(rel.target_label.trim().toLowerCase());
    await supabase.from("relationships").insert({
      case_id: caseId,
      evidence_file_id: evidenceId,
      ai_analysis_id: analysisId,
      source_entity_id: src ?? null,
      target_entity_id: tgt ?? null,
      relation_type: rel.relation_type,
      description: rel.description ?? null,
    });
  }
}
