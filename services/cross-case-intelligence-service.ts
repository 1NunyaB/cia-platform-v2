import OpenAI from "openai";
import { caseDirectorySearchBlob, formatCaseDirectoryForPrompt } from "@/lib/case-directory";
import type { AppSupabaseClient } from "@/types";
import type { CaseRow } from "@/types";
import { assertCrossCaseUserMessageShape } from "@/lib/ai-privacy-enforcement";
import { buildPrivacyRefusalFinding } from "@/lib/ai-privacy-refusal-finding";
import { evaluateCrossCaseQueryPrivacy } from "@/lib/ai-privacy-query-guard";
import { listPublicCases } from "@/services/case-service";
import { buildInvestigationUserContentBlock } from "@/services/case-investigation-context-blocks";
import { buildCrossCaseIntelligenceSystemPrompt } from "@/prompts/cross-case-intelligence";
import {
  crossCaseIntelligenceResponseSchema,
  type CrossCaseSourceParsed,
  type ShareSuggestionParsed,
} from "@/lib/schemas/cross-case-intelligence-response";
import { normalizeStructuredFinding } from "@/lib/schemas/structured-finding";
import { enforceFindingDiscipline, enforceSearchCorrelationDiscipline } from "@/services/analysis-finding-validation";
import type { AnalysisPipelineContext } from "@/lib/analysis-priority-doctrine";
import type { StructuredFinding } from "@/types/analysis";

const OTHER_CASE_LIMIT = 3;
const OTHER_MAX_FILES = 2;
const OTHER_MAX_CHARS = 2500;
const MIN_QUERY_LEN = 8;
const MAX_QUERY_LEN = 2000;

function relevanceScore(row: CaseRow, query: string): number {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 2);
  if (words.length === 0) return 0;
  const blob = caseDirectorySearchBlob(row).toLowerCase();
  let s = 0;
  for (const w of words) {
    if (blob.includes(w)) s += 2;
  }
  return s;
}

/**
 * Read-only: uses only public investigations + RLS-visible evidence/extracts (no notes/comments).
 */
export async function runCrossCaseIntelligenceQuery(
  supabase: AppSupabaseClient,
  input: { currentCaseId: string; userId: string; query: string },
): Promise<{
  finding: StructuredFinding;
  cross_case_sources: CrossCaseSourceParsed[];
  share_suggestion: ShareSuggestionParsed;
}> {
  const q = input.query.trim();
  if (q.length < MIN_QUERY_LEN) {
    throw new Error(`Ask a slightly longer question (at least ${MIN_QUERY_LEN} characters).`);
  }
  if (q.length > MAX_QUERY_LEN) {
    throw new Error("Question is too long — shorten and try again.");
  }

  const privacy = evaluateCrossCaseQueryPrivacy(q);
  if (privacy.blocked) {
    return {
      finding: buildPrivacyRefusalFinding(privacy.reason),
      cross_case_sources: [],
      share_suggestion: { suggest: false },
    };
  }

  const current = await buildInvestigationUserContentBlock(supabase, input.currentCaseId, {
    maxFiles: 14,
    maxCharsPerFile: 9000,
  });

  const publicCases = await listPublicCases(supabase);
  const candidates = (publicCases as CaseRow[])
    .filter((c) => c.id !== input.currentCaseId)
    .map((row) => ({ row, score: relevanceScore(row, q) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, OTHER_CASE_LIMIT);

  const otherBlocks: string[] = [];
  for (const { row } of candidates) {
    const slim = await buildInvestigationUserContentBlock(supabase, row.id, {
      maxFiles: OTHER_MAX_FILES,
      maxCharsPerFile: OTHER_MAX_CHARS,
    });
    const directoryBlock = formatCaseDirectoryForPrompt(row);
    const publicPreamble = `--- OTHER PUBLIC INVESTIGATION (directory-visible metadata + shared evidence extracts) ---
TITLE: ${row.title}
CASE_ID: ${row.id}
PUBLIC_DESCRIPTION (may be empty): ${(row.description ?? "").slice(0, 1200)}${(row.description ?? "").length > 1200 ? "…" : ""}
${directoryBlock ? `${directoryBlock}\n` : ""}
`;
    otherBlocks.push(`${publicPreamble}\n${slim.userContent}`);
  }

  const othersJoined =
    otherBlocks.length > 0
      ? otherBlocks.join("\n\n========\n\n")
      : "(No separate public investigations matched your question keywords for supplementary context. Answer from the current investigation only.)";

  const userMessage = `=== USER QUESTION ===
${q}

=== PRIMARY: CURRENT INVESTIGATION ===
${current.userContent}

=== SUPPLEMENTARY: OTHER PUBLIC INVESTIGATIONS (read-only; no private notes) ===
${othersJoined}

=== INSTRUCTIONS ===
Answer the user's question. Use supplementary blocks only when they add value and always label provenance per cross_case_sources rules.`;

  assertCrossCaseUserMessageShape(userMessage);

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
      { role: "system", content: buildCrossCaseIntelligenceSystemPrompt() },
      { role: "user", content: userMessage },
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

  const parsed = crossCaseIntelligenceResponseSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error("Model JSON did not match the cross-case intelligence schema");
  }

  const ctx: AnalysisPipelineContext = { scope: "case_investigation", caseAction: "explain_relevance" };
  let finding = normalizeStructuredFinding(parsed.data);
  finding = enforceSearchCorrelationDiscipline(finding);
  finding = enforceFindingDiscipline(finding, ctx);

  return {
    finding,
    cross_case_sources: parsed.data.cross_case_sources ?? [],
    share_suggestion: parsed.data.share_suggestion ?? { suggest: false },
  };
}
