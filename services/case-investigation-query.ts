import type { AppSupabaseClient } from "@/types";
import type { InvestigationCategorySlug } from "@/types/analysis";

export type EntityAliasRow = {
  id: string;
  alias_display: string;
  alias_normalized: string;
  strength: string;
  evidence_file_id: string | null;
};

export type EntityWithCategories = {
  id: string;
  label: string;
  entity_type: string | null;
  evidence_file_id: string | null;
  entity_categories: { category: InvestigationCategorySlug }[];
  entity_aliases?: EntityAliasRow[];
};

export async function listEntitiesWithCategories(
  supabase: AppSupabaseClient,
  caseId: string,
): Promise<EntityWithCategories[]> {
  const { data, error } = await supabase
    .from("entities")
    .select(
      "id, label, entity_type, evidence_file_id, entity_categories(category), entity_aliases(id, alias_display, alias_normalized, strength, evidence_file_id)",
    )
    .eq("case_id", caseId)
    .order("label", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as EntityWithCategories[];
}

export type EvidenceClusterRow = {
  id: string;
  title: string | null;
  rationale: string | null;
  cluster_kind?: string;
  evidence_cluster_members: {
    evidence_file_id: string;
    link_source?: string | null;
    /** PostgREST embed via FK to evidence_files (single row, not an array). */
    evidence_files: {
      id: string;
      original_filename: string;
      display_filename?: string | null;
      short_alias?: string | null;
    } | null;
  }[];
};

export async function listEvidenceClustersForCase(
  supabase: AppSupabaseClient,
  caseId: string,
): Promise<EvidenceClusterRow[]> {
  const { data, error } = await supabase
    .from("evidence_clusters")
    .select(
      `
      id,
      title,
      rationale,
      cluster_kind,
      evidence_cluster_members (
        evidence_file_id,
        link_source,
        evidence_files ( id, original_filename, display_filename, short_alias )
      )
    `,
    )
    .eq("case_id", caseId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as EvidenceClusterRow[];
}

/** Clusters that include the given evidence file (for evidence-linked discussion). */
export async function listEvidenceClustersContainingEvidence(
  supabase: AppSupabaseClient,
  caseId: string,
  evidenceId: string,
): Promise<EvidenceClusterRow[]> {
  const all = await listEvidenceClustersForCase(supabase, caseId);
  return all.filter((cl) =>
    (cl.evidence_cluster_members ?? []).some((m) => m.evidence_file_id === evidenceId),
  );
}

export type EvidenceLinkRow = {
  id: string;
  link_type: string;
  description: string | null;
  source_evidence_file_id: string;
  target_evidence_file_id: string;
};

export async function listEvidenceLinksForEvidence(
  supabase: AppSupabaseClient,
  caseId: string | null,
  evidenceId: string,
): Promise<{ link: EvidenceLinkRow; otherId: string; otherFilename: string }[]> {
  let q = supabase
    .from("evidence_links")
    .select("id, link_type, description, source_evidence_file_id, target_evidence_file_id")
    .or(`source_evidence_file_id.eq.${evidenceId},target_evidence_file_id.eq.${evidenceId}`);
  if (caseId) {
    q = q.eq("case_id", caseId);
  }
  const { data: links, error } = await q;

  if (error) throw new Error(error.message);

  const fileIds = new Set<string>();
  for (const l of links ?? []) {
    fileIds.add(l.source_evidence_file_id as string);
    fileIds.add(l.target_evidence_file_id as string);
  }

  const { data: files } = await supabase
    .from("evidence_files")
    .select("id, original_filename, display_filename, short_alias")
    .in("id", [...fileIds]);

  const nameById = Object.fromEntries(
    (files ?? []).map((f) => {
      const row = f as {
        id: string;
        original_filename: string;
        display_filename?: string | null;
        short_alias?: string | null;
      };
      const primary = (row.display_filename?.trim() || row.original_filename) as string;
      const alias = row.short_alias?.trim();
      const label = alias ? `${primary} · ${alias}` : primary;
      return [row.id, label];
    }),
  );

  return (links ?? []).map((l) => {
    const row = l as EvidenceLinkRow;
    const otherId =
      row.source_evidence_file_id === evidenceId
        ? row.target_evidence_file_id
        : row.source_evidence_file_id;
    return {
      link: row,
      otherId,
      otherFilename: nameById[otherId] ?? otherId,
    };
  });
}
