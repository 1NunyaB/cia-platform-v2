import OpenAI from "openai";
import { z } from "zod";
import {
  authenticityLabelZodSchema,
  authenticityOptionalNotesZodSchema,
  normalizeAuthenticityLabel,
  normalizeAuthenticityNotes,
} from "@/lib/schemas/authenticity-schema";
import { normalizeStructuredFinding, structuredFindingSchema } from "@/lib/schemas/structured-finding";
import { normalizeMediaAnalysisDetail } from "@/lib/schemas/media-analysis-schema";
import { normalizeConcealedLanguageAnalysis } from "@/lib/schemas/concealed-language-schema";
import { normalizeRedactionAnalysisDetail } from "@/lib/schemas/redaction-analysis-schema";
import type { AppSupabaseClient } from "@/types";
import {
  buildInvestigationSystemPrompt,
  buildInvestigationUserPrompt,
} from "@/prompts/investigation-analysis";
import { logActivity } from "@/services/activity-service";
import { recordContribution } from "@/services/contributions-service";
import { getEvidenceById, getExtractedText, updateEvidenceStatus } from "@/services/evidence-service";
import { normalizeSupplementalTimeline } from "@/lib/contextual-time-inference";
import { normalizeTimelineKind } from "@/lib/timeline-kind-schema";
import {
  downgradeConclusiveIfTimelineEntirelyContextualInference,
  enforceAuthenticityDiscipline,
  enforceConcealedLanguageDiscipline,
  enforceFindingDiscipline,
  enforceSearchCorrelationDiscipline,
  enforceAliasDiscipline,
  enforceMediaFindingDiscipline,
  finalizeMediaIdentityFollowup,
  validateTimelineContextualMetadata,
} from "@/services/analysis-finding-validation";
import type { AnalysisPipelineContext } from "@/lib/analysis-priority-doctrine";

const EVIDENCE_FILE_CONTEXT: AnalysisPipelineContext = { scope: "evidence_file" };
import {
  createCrossEvidenceResolver,
  loadEvidenceContentProfiles,
} from "@/lib/cross-evidence-resolution";
import {
  clearInvestigationArtifactsForEvidence,
  persistEntityGraph,
  persistEvidenceClusters,
  persistEvidencePairLinks,
  persistTimelineAndRelationships,
} from "@/services/investigation-graph";
import { isMediaAnalysisContext } from "@/lib/media-context";
import {
  ANALYSIS_FORMAT_VERSION,
  type AnalysisSupplemental,
  type AuthenticityLabel,
  type ConcealedLanguageAnalysisDetail,
  type MediaAnalysisDetail,
  type RedactionAnalysisDetail,
  type StoredAnalysisStructuredV2,
  type StructuredFinding,
} from "@/types/analysis";

const supplementalEntityAliasSchema = z.object({
  alias: z.string(),
  strength: z.enum(["weak", "moderate", "strong"]).optional(),
  basis: z.string().optional(),
});

const supplementalEntitySchema = z.object({
  label: z.string(),
  entity_type: z.string(),
  categories: z.array(z.string()).optional().default([]),
  mentions: z.array(z.object({ snippet: z.string() })).optional(),
  aliases: z.array(supplementalEntityAliasSchema).optional(),
});

const contextualTimeWindowSchema = z.object({
  start: z.string().nullable().optional(),
  end: z.string().nullable().optional(),
  label: z.string().optional(),
});

const contextualTimeInferenceSchema = z.object({
  reference_type: z.enum([
    "holiday",
    "public_event",
    "media_event",
    "cross_evidence_pattern",
    "other",
  ]),
  reference_description: z.string(),
  time_windows: z.array(contextualTimeWindowSchema).default([]),
  year_known: z.boolean(),
  year_assumed: z.boolean().optional(),
  limitations: z.string(),
  inference_explanation: z.string(),
  specificity: z.enum(["specific_known_year", "vague_or_ambiguous", "multiple_possible_windows"]),
});

const supplementalTimelineSchema = z.object({
  occurred_at: z.string().nullable().optional(),
  title: z.string(),
  summary: z.string().optional(),
  timeline_kind: z.string().optional(),
  source_label: z.string().optional(),
  event_classification: z.string().optional(),
  event_reasoning: z.string().optional(),
  event_limitations: z.string().optional(),
  supporting_evidence_filenames: z.array(z.string()).optional().default([]),
  timeline_tier: z.union([z.number(), z.string()]).optional(),
  timing_basis: z.enum(["direct_evidence", "contextual_inference", "mixed"]).optional(),
  contextual_time_inference: contextualTimeInferenceSchema.optional(),
  /** Per-event provenance slug; normalized in splitFindingAndSupplemental. */
  authenticity_label: z.string().optional().nullable(),
});

const supplementalRelationshipSchema = z.object({
  source_label: z.string(),
  target_label: z.string(),
  relation_type: z.string(),
  description: z.string().optional(),
});

const supplementalClusterSchema = z.object({
  title: z.string().optional(),
  rationale: z.string().optional(),
  evidence_filenames: z.array(z.string()).optional().default([]),
  cluster_kind: z.enum(["standard", "alias_focused"]).optional(),
});

const supplementalEvidenceLinkSchema = z.object({
  target_evidence_filename: z.string().optional().default(""),
  link_type: z.string().optional(),
  description: z.string().optional(),
});

const rawModelOutputSchema = structuredFindingSchema.extend({
  entities: z.array(supplementalEntitySchema).optional().default([]),
  timeline: z.array(supplementalTimelineSchema).optional().default([]),
  relationships: z.array(supplementalRelationshipSchema).optional().default([]),
  evidence_clusters: z.array(supplementalClusterSchema).optional().default([]),
  evidence_links: z.array(supplementalEvidenceLinkSchema).optional().default([]),
  /** Partial or loosely typed keys tolerated; normalized server-side. */
  redaction_analysis: z.any().optional(),
  media_analysis: z.any().optional(),
  concealed_language_analysis: z.any().optional(),
  authenticity_label: authenticityLabelZodSchema,
  authenticity_notes: authenticityOptionalNotesZodSchema,
});

export type RawModelOutput = z.infer<typeof rawModelOutputSchema>;

function emptyFindingFromWeakEvidence(): StructuredFinding {
  return {
    finding_answer:
      "No reliable finding can be produced from the available extracted text (missing or insufficient).",
    evidence_basis:
      "The supplied extracted text was empty or did not contain usable content for analysis.",
    confidence: "low",
    classification: "Uncertain",
    reasoning:
      "Analysis was not run against substantive text; no document-supported conclusions are justified.",
    limitations:
      "No verifiable content to analyze. Upload text-extractable material or complete OCR when applicable.",
    next_step: "Provide extractable text (e.g. text-based PDF or plain text) and re-run analysis.",
  };
}

function splitFindingAndSupplemental(raw: RawModelOutput): {
  finding: StructuredFinding;
  supplemental: AnalysisSupplemental;
  redactionAnalysis: RedactionAnalysisDetail | null;
  mediaAnalysis: MediaAnalysisDetail | null;
  concealedLanguageAnalysis: ConcealedLanguageAnalysisDetail | null;
  authenticityLabel: AuthenticityLabel;
  authenticityNotes?: string;
} {
  const finding: StructuredFinding = {
    finding_answer: raw.finding_answer,
    evidence_basis: raw.evidence_basis,
    confidence: raw.confidence,
    classification: raw.classification,
    reasoning: raw.reasoning,
    limitations: raw.limitations,
    next_step: raw.next_step,
  };

  const supplemental: AnalysisSupplemental = {
    entities: raw.entities.map((e) => ({
      label: e.label,
      entity_type: e.entity_type,
      categories: (e.categories ?? []).filter(Boolean),
      mentions: e.mentions,
      ...(e.aliases?.length
        ? {
            aliases: e.aliases.map((a) => ({
              alias: a.alias,
              ...(a.strength ? { strength: a.strength } : {}),
              ...(a.basis ? { basis: a.basis } : {}),
            })),
          }
        : {}),
    })),
    timeline: raw.timeline.map((t) => ({
      occurred_at: t.occurred_at,
      title: t.title,
      summary: t.summary,
      ...(t.timeline_kind !== undefined ? { timeline_kind: normalizeTimelineKind(t.timeline_kind) } : {}),
      ...(t.source_label !== undefined ? { source_label: t.source_label } : {}),
      ...(t.event_classification !== undefined ? { event_classification: t.event_classification } : {}),
      ...(t.event_reasoning !== undefined ? { event_reasoning: t.event_reasoning } : {}),
      ...(t.event_limitations !== undefined ? { event_limitations: t.event_limitations } : {}),
      supporting_evidence_filenames: t.supporting_evidence_filenames,
      ...(t.timeline_tier !== undefined ? { timeline_tier: t.timeline_tier } : {}),
      ...(t.timing_basis !== undefined ? { timing_basis: t.timing_basis } : {}),
      ...(t.contextual_time_inference !== undefined
        ? { contextual_time_inference: t.contextual_time_inference }
        : {}),
      ...(t.authenticity_label != null && String(t.authenticity_label).trim() !== ""
        ? { authenticity_label: normalizeAuthenticityLabel(t.authenticity_label) }
        : {}),
    })),
    relationships: raw.relationships,
    evidence_clusters: raw.evidence_clusters.map((c) => ({
      title: c.title,
      rationale: c.rationale,
      evidence_filenames: c.evidence_filenames,
      ...(c.cluster_kind ? { cluster_kind: c.cluster_kind } : {}),
    })),
    evidence_links: raw.evidence_links.map((l) => ({
      target_evidence_filename: l.target_evidence_filename?.trim() || undefined,
      link_type: l.link_type,
      description: l.description,
    })),
  };

  const redactionAnalysis = normalizeRedactionAnalysisDetail(raw.redaction_analysis);
  const mediaAnalysis = normalizeMediaAnalysisDetail(raw.media_analysis);
  const concealedLanguageAnalysis = normalizeConcealedLanguageAnalysis(raw.concealed_language_analysis);
  const authenticityLabel = normalizeAuthenticityLabel(raw.authenticity_label);
  const authenticityNotes = normalizeAuthenticityNotes(raw.authenticity_notes);

  return {
    finding,
    supplemental,
    redactionAnalysis,
    mediaAnalysis,
    concealedLanguageAnalysis,
    authenticityLabel,
    authenticityNotes,
  };
}

export async function clearAnalysisForEvidence(
  supabase: AppSupabaseClient,
  evidenceId: string,
  caseId: string | null,
) {
  await clearInvestigationArtifactsForEvidence(supabase, evidenceId, caseId);
}

export async function runAiAnalysisForEvidence(
  supabase: AppSupabaseClient,
  input: {
    evidenceId: string;
    /** Null when analyzing library evidence not yet assigned to a case (no graph persistence). */
    caseId: string | null;
    /** Signed-in user; null for guest-owned library evidence. */
    userId: string | null;
    /** When set, library activity logs use guest attribution. */
    guestSessionId?: string | null;
    extractedText: string;
  },
): Promise<{ analysisId: string }> {
  await updateEvidenceStatus(supabase, input.evidenceId, "analyzing");

  const extracted = input.extractedText.trim();
  if (!extracted) {
    const finding = enforceFindingDiscipline(
      normalizeStructuredFinding(emptyFindingFromWeakEvidence()),
      EVIDENCE_FILE_CONTEXT,
    );
    const stored: StoredAnalysisStructuredV2 = {
      format_version: ANALYSIS_FORMAT_VERSION,
      finding,
      authenticity_label: "unverified",
      authenticity_notes: "No extractable text; authenticity cannot be assessed from this file.",
      supplemental: {
        entities: [],
        timeline: [],
        relationships: [],
        evidence_clusters: [],
        evidence_links: [],
      },
    };
    return persistAnalysis(supabase, {
      evidenceId: input.evidenceId,
      caseId: input.caseId,
      userId: input.userId,
      guestSessionId: input.guestSessionId,
      model: "none",
      summary: finding.finding_answer,
      redactionNotes: null,
      structured: stored,
      supplementalForGraph: stored.supplemental!,
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    await updateEvidenceStatus(supabase, input.evidenceId, "error", "OPENAI_API_KEY is not configured.");
    throw new Error("OPENAI_API_KEY is not configured. Add it to .env.local (see .env.local.example).");
  }

  const openai = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";

  const [evidenceRow, extractedRow] = await Promise.all([
    getEvidenceById(supabase, input.evidenceId),
    getExtractedText(supabase, input.evidenceId),
  ]);
  const mediaContext = isMediaAnalysisContext({
    mimeType: evidenceRow?.mime_type ?? null,
    extractionMethod: extractedRow?.extraction_method ?? null,
  });

  const systemPrompt = buildInvestigationSystemPrompt(mediaContext);
  const userContent = buildInvestigationUserPrompt(extracted, { mediaContext });

  const completion = await openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    await updateEvidenceStatus(supabase, input.evidenceId, "error", "Empty model response");
    throw new Error("Empty model response");
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    await updateEvidenceStatus(supabase, input.evidenceId, "error", "Invalid JSON from model");
    throw new Error("Model did not return valid JSON");
  }

  const parsed = rawModelOutputSchema.safeParse(parsedJson);
  if (!parsed.success) {
    await updateEvidenceStatus(supabase, input.evidenceId, "error", "Schema mismatch from model");
    throw new Error("Model JSON did not match expected finding schema");
  }

  let {
    finding,
    supplemental,
    redactionAnalysis,
    mediaAnalysis,
    concealedLanguageAnalysis,
    authenticityLabel,
    authenticityNotes,
  } = splitFindingAndSupplemental(parsed.data);
  supplemental = normalizeSupplementalTimeline(supplemental);
  const timelineQa = validateTimelineContextualMetadata(supplemental);
  if (timelineQa.length > 0) {
    console.warn("[ai-analysis] timeline contextual QA:", timelineQa.join("; "));
  }
  finding = normalizeStructuredFinding(finding);
  finding = enforceAuthenticityDiscipline(finding, authenticityLabel, authenticityNotes);
  finding = enforceMediaFindingDiscipline(finding, mediaAnalysis);
  finding = downgradeConclusiveIfTimelineEntirelyContextualInference(finding, supplemental);
  finding = enforceConcealedLanguageDiscipline(finding, concealedLanguageAnalysis);
  finding = enforceSearchCorrelationDiscipline(finding);
  finding = enforceAliasDiscipline(finding);
  finding = enforceFindingDiscipline(finding, EVIDENCE_FILE_CONTEXT);
  finding = finalizeMediaIdentityFollowup(finding, mediaAnalysis);

  const stored: StoredAnalysisStructuredV2 = {
    format_version: ANALYSIS_FORMAT_VERSION,
    finding,
    authenticity_label: authenticityLabel,
    ...(authenticityNotes ? { authenticity_notes: authenticityNotes } : {}),
    supplemental,
    ...(redactionAnalysis ? { redaction_analysis: redactionAnalysis } : {}),
    ...(mediaAnalysis ? { media_analysis: mediaAnalysis } : {}),
    ...(concealedLanguageAnalysis ? { concealed_language_analysis: concealedLanguageAnalysis } : {}),
  };

  return persistAnalysis(supabase, {
    evidenceId: input.evidenceId,
    caseId: input.caseId,
    userId: input.userId,
    guestSessionId: input.guestSessionId,
    model,
    summary: finding.finding_answer,
    redactionNotes: null,
    structured: stored,
    supplementalForGraph: supplemental,
  });
}

async function persistAnalysis(
  supabase: AppSupabaseClient,
  args: {
    evidenceId: string;
    caseId: string | null;
    userId: string | null;
    guestSessionId?: string | null;
    model: string;
    summary: string;
    redactionNotes: string | null;
    structured: StoredAnalysisStructuredV2;
    supplementalForGraph: AnalysisSupplemental;
  },
): Promise<{ analysisId: string }> {
  const {
    evidenceId,
    caseId,
    userId,
    guestSessionId,
    model,
    summary,
    redactionNotes,
    structured,
    supplementalForGraph,
  } = args;

  await clearInvestigationArtifactsForEvidence(supabase, evidenceId, caseId);

  const f = structured.finding;
  const { data: analysisRow, error: aErr } = await supabase
    .from("ai_analyses")
    .insert({
      evidence_file_id: evidenceId,
      summary,
      redaction_notes: redactionNotes,
      model,
      structured: structured as unknown as Record<string, unknown>,
      full_response_json: structured as unknown as Record<string, unknown>,
      analysis_kind: "evidence_file",
      inquiry_prompt: null,
      finding_answer: f.finding_answer,
      confidence_label: f.confidence,
      classification: f.classification,
      reasoning: f.reasoning,
      limitations: f.limitations,
      suggested_next_steps: f.next_step,
    })
    .select("id")
    .single();

  if (aErr) {
    await updateEvidenceStatus(supabase, evidenceId, "error", aErr.message);
    throw new Error(aErr.message);
  }

  const analysisId = analysisRow!.id as string;

  if (!caseId) {
    await updateEvidenceStatus(supabase, evidenceId, "complete");
    await logActivity(supabase, {
      caseId: null,
      actorId: guestSessionId ? null : userId,
      actorLabel: guestSessionId ? "Guest" : "System",
      action: "evidence.analyzed",
      entityType: "ai_analysis",
      entityId: analysisId,
      payload: {
        evidence_file_id: evidenceId,
        model,
        library: true,
        ...(guestSessionId ? { guest_session_id: guestSessionId } : {}),
      },
    });
    return { analysisId };
  }

  const profiles = await loadEvidenceContentProfiles(
    supabase,
    caseId,
    evidenceId,
    supplementalForGraph.entities,
  );
  const resolver = createCrossEvidenceResolver(evidenceId, profiles);

  const labelToEntityId = await persistEntityGraph(supabase, {
    caseId,
    evidenceId,
    analysisId,
    supplemental: supplementalForGraph,
  });

  await persistEvidenceClusters(supabase, {
    caseId,
    evidenceId,
    analysisId,
    supplemental: supplementalForGraph,
    resolver,
  });

  await persistEvidencePairLinks(supabase, {
    caseId,
    evidenceId,
    analysisId,
    supplemental: supplementalForGraph,
    resolver,
  });

  await persistTimelineAndRelationships(supabase, {
    caseId,
    evidenceId,
    analysisId,
    supplemental: supplementalForGraph,
    labelToEntityId,
    resolver,
    finding: structured.finding,
    structured,
  });

  await updateEvidenceStatus(supabase, evidenceId, "complete");

  if (userId) {
    await recordContribution(supabase, {
      caseId,
      userId,
      kind: "analysis_run",
      refId: analysisId,
    });
  }

  await logActivity(supabase, {
    caseId,
    actorId: userId,
    actorLabel: "System",
    action: "evidence.analyzed",
    entityType: "ai_analysis",
    entityId: analysisId,
    payload: { evidence_file_id: evidenceId, model },
  });

  return { analysisId };
}
