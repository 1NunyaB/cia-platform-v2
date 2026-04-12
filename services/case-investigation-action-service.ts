import OpenAI from "openai";
import {
  buildCaseInvestigationSystemPrompt,
  type CaseInvestigationActionKind,
} from "@/prompts/investigation-case-actions";
import { normalizeStructuredFinding, structuredFindingSchema } from "@/lib/schemas/structured-finding";
import type { AppSupabaseClient } from "@/types";
import { getEvidenceForCase, getExtractedText } from "@/services/evidence-service";
import {
  listEntitiesWithCategories,
  listEvidenceClustersForCase,
} from "@/services/case-investigation-query";
import { enforceFindingDiscipline, enforceSearchCorrelationDiscipline } from "@/services/analysis-finding-validation";
import type { AnalysisPipelineContext } from "@/lib/analysis-priority-doctrine";
import { logActivity } from "@/services/activity-service";
import type { StructuredFinding } from "@/types/analysis";

const MAX_FILES = 14;
const MAX_CHARS_PER_FILE = 9000;

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n[…truncated for length]`;
}

/**
 * Loads evidence extracts, entities, and cluster summaries for a case-level AI pass.
 */
export async function runCaseInvestigationAction(
  supabase: AppSupabaseClient,
  input: { caseId: string; userId: string; action: CaseInvestigationActionKind },
): Promise<{ finding: StructuredFinding }> {
  const { caseId, userId, action } = input;

  const files = await getEvidenceForCase(supabase, caseId);
  const slice = files.slice(0, MAX_FILES);

  const extracts: { id: string; filename: string; text: string }[] = [];
  for (const row of slice) {
    const id = row.id as string;
    const fn = (row.original_filename as string) ?? id;
    const ex = await getExtractedText(supabase, id);
    const raw = (ex?.raw_text as string) ?? "";
    if (raw.trim()) {
      extracts.push({ id, filename: fn, text: truncate(raw, MAX_CHARS_PER_FILE) });
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
          .map(
            (x) =>
              `--- FILE: ${x.filename} (id: ${x.id})\n${x.text}`,
          )
          .join("\n\n");

  const userContent = `CASE ID: ${caseId}

=== ENTITY REGISTRY (canonical labels) ===
${entityBlock}

=== EVIDENCE CLUSTERS (if any) ===
${clusterBlock}

=== EXTRACTED TEXT BY FILE ===
${evidenceBlock}
`;

  if (extracts.length === 0) {
    const weak: StructuredFinding = {
      finding_answer:
        "No extracted text is available across case files — case-level analysis cannot cite document content.",
      evidence_basis: "No non-empty extracts were loaded; entity and cluster metadata alone is insufficient for strong findings.",
      confidence: "low",
      classification: "Uncertain",
      reasoning: "Without extractable text, conclusions must remain minimal.",
      limitations: "Upload text-based documents or add OCR, then run per-file extraction before case-level review.",
      next_step: "Add extractable evidence and re-run this action.",
    };
    const ctx: AnalysisPipelineContext = { scope: "case_investigation", caseAction: action };
    let finding = normalizeStructuredFinding(weak);
    finding = enforceSearchCorrelationDiscipline(finding);
    return { finding: enforceFindingDiscipline(finding, ctx) };
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const completion = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildCaseInvestigationSystemPrompt(action) },
      { role: "user", content: userContent },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("Empty model response");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error("Model did not return valid JSON");
  }

  const parsed = structuredFindingSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error("Model JSON did not match the structured finding schema");
  }

  const ctx: AnalysisPipelineContext = { scope: "case_investigation", caseAction: action };
  let finding = normalizeStructuredFinding(parsed.data);
  finding = enforceSearchCorrelationDiscipline(finding);
  finding = enforceFindingDiscipline(finding, ctx);

  await logActivity(supabase, {
    caseId,
    actorId: userId,
    actorLabel: "Analyst",
    action: `case.investigation_action.${action}`,
    entityType: "case",
    entityId: caseId,
    payload: { action },
  });

  return { finding };
}
