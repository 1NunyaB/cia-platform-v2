import OpenAI from "openai";
import {
  buildCaseInvestigationSystemPrompt,
  type CaseInvestigationActionKind,
} from "@/prompts/investigation-case-actions";
import { normalizeStructuredFinding, structuredFindingSchema } from "@/lib/schemas/structured-finding";
import type { AppSupabaseClient } from "@/types";
import { buildInvestigationUserContentBlock } from "@/services/case-investigation-context-blocks";
import { enforceFindingDiscipline, enforceSearchCorrelationDiscipline } from "@/services/analysis-finding-validation";
import type { AnalysisPipelineContext } from "@/lib/analysis-priority-doctrine";
import { logActivity } from "@/services/activity-service";
import type { StructuredFinding } from "@/types/analysis";

/**
 * Loads evidence extracts, entities, and cluster summaries for a case-level AI pass.
 */
export async function runCaseInvestigationAction(
  supabase: AppSupabaseClient,
  input: { caseId: string; userId: string; action: CaseInvestigationActionKind },
): Promise<{ finding: StructuredFinding }> {
  const { caseId, userId, action } = input;

  const { userContent, hasExtracts } = await buildInvestigationUserContentBlock(supabase, caseId, {
    maxFiles: 14,
    maxCharsPerFile: 9000,
  });

  if (!hasExtracts) {
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
