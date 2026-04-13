import { normalizeStructuredFinding } from "@/lib/schemas/structured-finding";
import { enforceFindingDiscipline, enforceSearchCorrelationDiscipline } from "@/services/analysis-finding-validation";
import type { AnalysisPipelineContext } from "@/lib/analysis-priority-doctrine";
import type { StructuredFinding } from "@/types/analysis";

/**
 * Privacy-safe structured response when a query is blocked before any model call (Test 4).
 */
export function buildPrivacyRefusalFinding(detail: string): StructuredFinding {
  const ctx: AnalysisPipelineContext = { scope: "case_investigation", caseAction: "explain_relevance" };
  let finding = normalizeStructuredFinding({
    finding_answer:
      "This request was not processed because it could conflict with privacy rules for collaborator notes, personal data, or restricted content.",
    evidence_basis:
      "No model inference was run. The platform only passes shared evidence extracts, investigation graph data, and public directory fields to the assistant — never private notes or hidden session data.",
    confidence: "high",
    classification: "Uncertain",
    reasoning: detail,
    limitations:
      "Ask about uploaded evidence, extracted text, entities, clusters, or public investigation information only.",
    next_step: "Rephrase your question to refer to evidence files or non-private investigation context.",
  });
  finding = enforceSearchCorrelationDiscipline(finding);
  return enforceFindingDiscipline(finding, ctx);
}
