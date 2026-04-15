import type { AppSupabaseClient } from "@/types";
import {
  INVESTIGATION_STACK_KINDS,
  INVESTIGATION_STACK_LABEL,
  type InvestigationStackKind,
} from "@/lib/investigation-stacks";
import { assertEvidenceLinkedToCase } from "@/services/case-evidence-ingest";

/** Ensure one `evidence_clusters` row per canonical stack for the case (idempotent). */
export async function ensureInvestigationStacksForCase(
  supabase: AppSupabaseClient,
  caseId: string,
): Promise<Map<InvestigationStackKind, string>> {
  const map = new Map<InvestigationStackKind, string>();

  const { data: existing, error: selErr } = await supabase
    .from("evidence_clusters")
    .select("id, stack_kind")
    .eq("case_id", caseId);

  if (selErr) throw new Error(selErr.message);
  for (const row of existing ?? []) {
    const sk = row.stack_kind as string | null;
    if (sk && INVESTIGATION_STACK_KINDS.includes(sk as InvestigationStackKind)) {
      map.set(sk as InvestigationStackKind, row.id as string);
    }
  }

  for (const kind of INVESTIGATION_STACK_KINDS) {
    if (map.has(kind)) continue;
    const { data: ins, error: insErr } = await supabase
      .from("evidence_clusters")
      .insert({
        case_id: caseId,
        stack_kind: kind,
        title: INVESTIGATION_STACK_LABEL[kind],
      })
      .select("id")
      .maybeSingle();

    if (insErr) {
      if (insErr.code === "23505") {
        const { data: retry } = await supabase
          .from("evidence_clusters")
          .select("id")
          .eq("case_id", caseId)
          .eq("stack_kind", kind)
          .maybeSingle();
        if (retry?.id) map.set(kind, retry.id as string);
        continue;
      }
      throw new Error(insErr.message);
    }
    if (ins?.id) map.set(kind, ins.id as string);
  }

  return map;
}

/** Add evidence to a stack; duplicate membership is ignored (no duplicate rows). */
export async function addEvidenceToInvestigationStack(
  supabase: AppSupabaseClient,
  input: { clusterId: string; evidenceFileId: string },
): Promise<{ inserted: boolean }> {
  const { error } = await supabase.from("evidence_cluster_members").insert({
    cluster_id: input.clusterId,
    evidence_file_id: input.evidenceFileId,
  });
  if (!error) return { inserted: true };
  if (error.code === "23505") return { inserted: false };
  throw new Error(error.message);
}

export type BulkStackRowResult = {
  evidenceId: string;
  stackKind: InvestigationStackKind;
  ok: boolean;
  skippedDuplicate?: boolean;
  error?: string;
};

/**
 * For each evidence × stack, add membership if linked to the case. Duplicates are skipped (no duplicate rows).
 * One evidence failing does not stop others.
 */
export async function bulkAddEvidenceToInvestigationStacks(
  supabase: AppSupabaseClient,
  input: {
    caseId: string;
    evidenceIds: string[];
    stackKinds: InvestigationStackKind[];
  },
): Promise<{ results: BulkStackRowResult[] }> {
  const results: BulkStackRowResult[] = [];
  if (input.stackKinds.length === 0 || input.evidenceIds.length === 0) {
    return { results };
  }

  const kindSet = new Set(input.stackKinds);
  const kinds = INVESTIGATION_STACK_KINDS.filter((k) => kindSet.has(k));
  const clusterByKind = await ensureInvestigationStacksForCase(supabase, input.caseId);

  for (const evidenceId of input.evidenceIds) {
    try {
      await assertEvidenceLinkedToCase(supabase, evidenceId, input.caseId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      for (const stackKind of kinds) {
        results.push({ evidenceId, stackKind, ok: false, error: msg });
      }
      continue;
    }

    for (const stackKind of kinds) {
      const clusterId = clusterByKind.get(stackKind);
      if (!clusterId) {
        results.push({
          evidenceId,
          stackKind,
          ok: false,
          error: "Stack cluster missing after ensure.",
        });
        continue;
      }
      try {
        const { inserted } = await addEvidenceToInvestigationStack(supabase, {
          clusterId,
          evidenceFileId: evidenceId,
        });
        results.push({
          evidenceId,
          stackKind,
          ok: true,
          skippedDuplicate: !inserted,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        results.push({ evidenceId, stackKind, ok: false, error: msg });
      }
    }
  }

  return { results };
}
