/**
 * Case index snapshot (navigation layer) — read-only aggregation for the case workspace.
 * Canonical names and aliases always come from `evidence_files` in the database; this module does not mint
 * new display strings. See `lib/evidence-database-vs-index.ts`.
 */
import type { AppSupabaseClient } from "@/types";
import { listEvidenceClustersForCase, type EvidenceClusterRow } from "@/services/case-investigation-query";
import { EVIDENCE_SOURCE_TYPE_LABELS, type EvidenceSourceType } from "@/lib/evidence-source";

export type CaseIndexCluster = {
  id: string;
  title: string;
  evidenceIds: string[];
};

export type CaseIndexAlias = {
  id: string;
  aliasDisplay: string;
  entityLabel: string;
  evidenceIds: string[];
};

export type CaseIndexEntityBucket = {
  entityId: string;
  label: string;
  evidenceIds: string[];
};

export type CaseIndexYearMonth = {
  key: string;
  label: string;
  evidenceIds: string[];
};

export type CaseIndexTimelineEvent = {
  id: string;
  title: string;
  occurredAt: string | null;
  evidenceIds: string[];
};

export type CaseIndexSource = {
  key: string;
  label: string;
  sourceType: EvidenceSourceType;
  platform: string | null;
  program: string | null;
  evidenceIds: string[];
};

export type CaseIndexEvidenceItem = {
  evidenceId: string;
  displayFilename: string;
  shortAlias: string;
  originalFilename: string;
};

export type CaseIndexSnapshot = {
  evidenceItems: CaseIndexEvidenceItem[];
  clusters: CaseIndexCluster[];
  aliases: CaseIndexAlias[];
  accusers: CaseIndexEntityBucket[];
  victims: CaseIndexEntityBucket[];
  locations: CaseIndexEntityBucket[];
  years: CaseIndexYearMonth[];
  months: CaseIndexYearMonth[];
  events: CaseIndexTimelineEvent[];
  sources: CaseIndexSource[];
};

function uniq(ids: string[]): string[] {
  return [...new Set(ids.filter(Boolean))];
}

function addToMap(map: Map<string, Set<string>>, key: string, eid: string) {
  if (!eid) return;
  const s = map.get(key) ?? new Set<string>();
  s.add(eid);
  map.set(key, s);
}

function isLocationEntityType(entityType: string | null): boolean {
  if (!entityType) return false;
  const t = entityType.toLowerCase();
  return /place|location|address|venue|city|region|country|geograph|site|coordinates|gps|map|landmark/.test(t);
}

/**
 * Aggregates case-level index buckets from evidence metadata, entities, aliases, timelines, and clusters.
 * No separate reindex table — recomputed on each load / realtime refresh.
 */
export async function getCaseIndexSnapshot(
  supabase: AppSupabaseClient,
  caseId: string,
): Promise<CaseIndexSnapshot> {
  const [{ data: evidenceRows }, { data: entityRows }, { data: aliasRows }, { data: timelineRows }, clusters] =
    await Promise.all([
      supabase
        .from("evidence_files")
        .select(
          "id, created_at, original_filename, display_filename, short_alias, source_type, source_platform, source_program, source_url",
        )
        .eq("case_id", caseId),
      supabase
        .from("entities")
        .select("id, label, entity_type, evidence_file_id, entity_categories(category)")
        .eq("case_id", caseId),
      supabase.from("entity_aliases").select("id, alias_display, entity_id").eq("case_id", caseId),
      supabase.from("timeline_events").select("id, title, occurred_at").eq("case_id", caseId),
      listEvidenceClustersForCase(supabase, caseId),
    ]);

  const entityIds = (entityRows ?? []).map((e) => e.id as string);
  const teIds = (timelineRows ?? []).map((t) => t.id as string);

  const [{ data: mentionRows }, { data: teLinkRows }] = await Promise.all([
    entityIds.length
      ? supabase.from("entity_mentions").select("entity_id, evidence_file_id").in("entity_id", entityIds)
      : Promise.resolve({ data: [] as { entity_id: string; evidence_file_id: string }[] }),
    teIds.length
      ? supabase.from("timeline_event_evidence").select("timeline_event_id, evidence_file_id").in("timeline_event_id", teIds)
      : Promise.resolve({ data: [] as { timeline_event_id: string; evidence_file_id: string }[] }),
  ]);

  const mentionsByEntity = new Map<string, string[]>();
  for (const m of mentionRows ?? []) {
    const eid = m.entity_id as string;
    const fid = m.evidence_file_id as string;
    const arr = mentionsByEntity.get(eid) ?? [];
    arr.push(fid);
    mentionsByEntity.set(eid, arr);
  }

  function evidenceForEntity(entityId: string, primaryFile: string | null): string[] {
    const fromMentions = mentionsByEntity.get(entityId) ?? [];
    const out = [...fromMentions];
    if (primaryFile) out.push(primaryFile);
    return uniq(out);
  }

  const accusers: CaseIndexEntityBucket[] = [];
  const victims: CaseIndexEntityBucket[] = [];
  const locations: CaseIndexEntityBucket[] = [];

  for (const e of entityRows ?? []) {
    const id = e.id as string;
    const label = e.label as string;
    const et = (e.entity_type as string | null) ?? null;
    const primary = (e.evidence_file_id as string | null) ?? null;
    const cats = (e.entity_categories ?? []) as { category: string }[];
    const slugSet = new Set(cats.map((c) => c.category));

    const bucket: CaseIndexEntityBucket = {
      entityId: id,
      label,
      evidenceIds: evidenceForEntity(id, primary),
    };

    if (slugSet.has("accusers")) accusers.push(bucket);
    if (slugSet.has("victims")) victims.push(bucket);
    if (isLocationEntityType(et)) locations.push(bucket);
  }

  const entityById = new Map((entityRows ?? []).map((e) => [e.id as string, e]));

  const aliases: CaseIndexAlias[] = [];
  for (const a of aliasRows ?? []) {
    const entityId = a.entity_id as string;
    const entRow = entityById.get(entityId);
    const entityLabel = String(entRow?.label ?? "");
    const primary = (entRow?.evidence_file_id as string | null) ?? null;
    const evidenceIds = evidenceForEntity(entityId, primary);
    aliases.push({
      id: a.id as string,
      aliasDisplay: a.alias_display as string,
      entityLabel,
      evidenceIds,
    });
  }

  const yearMap = new Map<string, Set<string>>();
  const monthMap = new Map<string, Set<string>>();

  for (const ev of evidenceRows ?? []) {
    const id = ev.id as string;
    const c = ev.created_at as string | undefined;
    if (c) {
      const d = new Date(c);
      if (!Number.isNaN(d.getTime())) {
        addToMap(yearMap, String(d.getFullYear()), id);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        addToMap(monthMap, ym, id);
      }
    }
  }

  const teById = new Map((timelineRows ?? []).map((t) => [t.id as string, t]));

  for (const row of teLinkRows ?? []) {
    const teId = row.timeline_event_id as string;
    const fid = row.evidence_file_id as string;
    const te = teById.get(teId);
    const at = te?.occurred_at as string | null | undefined;
    if (at) {
      const d = new Date(at);
      if (!Number.isNaN(d.getTime())) {
        addToMap(yearMap, String(d.getFullYear()), fid);
        const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        addToMap(monthMap, ym, fid);
      }
    }
  }

  const years: CaseIndexYearMonth[] = [...yearMap.entries()]
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([key, set]) => ({
      key,
      label: key,
      evidenceIds: [...set],
    }));

  const months: CaseIndexYearMonth[] = [...monthMap.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, set]) => ({
      key,
      label: key,
      evidenceIds: [...set],
    }));

  const events: CaseIndexTimelineEvent[] = (timelineRows ?? []).map((t) => {
    const id = t.id as string;
    const links = (teLinkRows ?? []).filter((l) => l.timeline_event_id === id);
    return {
      id,
      title: (t.title as string) ?? "Event",
      occurredAt: (t.occurred_at as string | null) ?? null,
      evidenceIds: uniq(links.map((l) => l.evidence_file_id as string)),
    };
  });

  const sourceMap = new Map<string, Set<string>>();
  const sourceMeta = new Map<
    string,
    { sourceType: EvidenceSourceType; platform: string | null; program: string | null }
  >();

  for (const ev of evidenceRows ?? []) {
    const id = ev.id as string;
    const st = (ev.source_type as EvidenceSourceType) ?? "unknown";
    const pf = (ev.source_platform as string | null) ?? null;
    const pg = (ev.source_program as string | null) ?? null;
    const key = `t:${st}|p:${(pf ?? "").toLowerCase()}|g:${(pg ?? "").toLowerCase()}`;
    addToMap(sourceMap, key, id);
    if (!sourceMeta.has(key)) {
      sourceMeta.set(key, { sourceType: st, platform: pf, program: pg });
    }
  }

  const sources: CaseIndexSource[] = [...sourceMap.entries()].map(([key, set]) => {
    const meta = sourceMeta.get(key)!;
    const typeLabel = EVIDENCE_SOURCE_TYPE_LABELS[meta.sourceType] ?? meta.sourceType;
    const plat = meta.platform?.trim() || null;
    const prog = meta.program?.trim() || null;
    const labelParts = [typeLabel, plat, prog].filter(Boolean);
    const label = labelParts.length ? labelParts.join(" · ") : typeLabel;
    return {
      key,
      label,
      sourceType: meta.sourceType,
      platform: plat,
      program: prog,
      evidenceIds: [...set],
    };
  });

  sources.sort((a, b) => a.label.localeCompare(b.label));

  const evidenceItems: CaseIndexEvidenceItem[] = (evidenceRows ?? [])
    .map((row) => ({
      evidenceId: row.id as string,
      displayFilename: String(row.display_filename ?? row.original_filename ?? ""),
      shortAlias: String(row.short_alias ?? ""),
      originalFilename: String(row.original_filename ?? ""),
    }))
    .sort((a, b) => a.displayFilename.localeCompare(b.displayFilename));

  const clusterIndex: CaseIndexCluster[] = (clusters as EvidenceClusterRow[]).map((cl) => ({
    id: cl.id,
    title: cl.title ?? "Untitled cluster",
    evidenceIds: uniq((cl.evidence_cluster_members ?? []).map((m) => m.evidence_file_id)),
  }));

  return {
    evidenceItems,
    clusters: clusterIndex,
    aliases,
    accusers,
    victims,
    locations,
    years,
    months,
    events,
    sources,
  };
}
