import type { AppSupabaseClient } from "@/types";
import { assertInvestigationPromptAllowedShape } from "@/lib/ai-privacy-enforcement";
import { getEvidenceForCase, getExtractedText } from "@/services/evidence-service";
import {
  listEntitiesWithCategories,
  listEvidenceClustersForCase,
} from "@/services/case-investigation-query";

const DEFAULT_MAX_FILES = 14;
const DEFAULT_MAX_CHARS = 9000;

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n[…truncated for length]`;
}

/**
 * Builds the user-message block for case-level investigation AI (entities, clusters, extracts).
 * Shared by preset investigation actions and cross-investigation read-only intelligence.
 *
 * Privacy: does not load case notes, comments, activity, or profiles — only evidence extracts and graph fields
 * (see `INVESTIGATION_AI_ALLOWED_SOURCES`). Validated by `assertInvestigationPromptAllowedShape` before return.
 */
export async function buildInvestigationUserContentBlock(
  supabase: AppSupabaseClient,
  caseId: string,
  opts?: { maxFiles?: number; maxCharsPerFile?: number },
): Promise<{ userContent: string; hasExtracts: boolean }> {
  const maxFiles = opts?.maxFiles ?? DEFAULT_MAX_FILES;
  const maxChars = opts?.maxCharsPerFile ?? DEFAULT_MAX_CHARS;

  const files = await getEvidenceForCase(supabase, caseId);
  const slice = files.slice(0, maxFiles);

  const extracts: { id: string; filename: string; text: string }[] = [];
  for (const row of slice) {
    const id = row.id as string;
    const fn = (row.original_filename as string) ?? id;
    const ex = await getExtractedText(supabase, id);
    const raw = (ex?.raw_text as string) ?? "";
    if (raw.trim()) {
      extracts.push({ id, filename: fn, text: truncate(raw, maxChars) });
    }
  }

  const entities = await listEntitiesWithCategories(supabase, caseId);
  const clusters = await listEvidenceClustersForCase(supabase, caseId);

  const entityBlock =
    entities.length === 0
      ? "(No entities stored for this case yet.)"
      : entities
          .map((e) => {
            const cats = (e.entity_categories ?? []).map((c) => c.category).join(", ");
            return `- ${e.label} | type: ${e.entity_type ?? "—"} | categories: ${cats || "—"}`;
          })
          .join("\n");

  const clusterBlock =
    clusters.length === 0
      ? "(No evidence clusters stored yet — run per-file analysis with cluster hints to populate.)"
      : clusters
          .map((cl) => {
            const names = (cl.evidence_cluster_members ?? [])
              .map((m) => m.evidence_files?.original_filename ?? m.evidence_file_id)
              .join("; ");
            return `- ${cl.title ?? "Cluster"}: ${cl.rationale ?? "—"} | linked files: ${names || "—"}`;
          })
          .join("\n");

  const evidenceBlock =
    extracts.length === 0
      ? "NO EXTRACTED TEXT AVAILABLE for any file in this case."
      : extracts
          .map((x) => `--- FILE: ${x.filename} (id: ${x.id})\n${x.text}`)
          .join("\n\n");

  const userContent = `CASE ID: ${caseId}

=== ENTITY REGISTRY (canonical labels) ===
${entityBlock}

=== EVIDENCE CLUSTERS (if any) ===
${clusterBlock}

=== EXTRACTED TEXT BY FILE ===
${evidenceBlock}
`;

  assertInvestigationPromptAllowedShape(userContent);

  return { userContent, hasExtracts: extracts.length > 0 };
}
