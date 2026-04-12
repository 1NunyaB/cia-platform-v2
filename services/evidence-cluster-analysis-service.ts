import OpenAI from "openai";
import { EVIDENCE_CLUSTER_ANALYSIS_SYSTEM } from "@/prompts/evidence-cluster-analysis";
import { clusterAiModelOutputSchema } from "@/lib/schemas/cluster-ai-output";
import { normalizeConcealedLanguageAnalysis } from "@/lib/schemas/concealed-language-schema";
import { normalizeStructuredFinding } from "@/lib/schemas/structured-finding";
import type { AppSupabaseClient } from "@/types";
import { getExtractedText } from "@/services/evidence-service";
import { listEntitiesWithCategories } from "@/services/case-investigation-query";
import {
  enforceAuthenticityDiscipline,
  enforceConcealedLanguageDiscipline,
  enforceFindingDiscipline,
  enforceSearchCorrelationDiscipline,
  enforceAliasDiscipline,
} from "@/services/analysis-finding-validation";
import type { AnalysisPipelineContext } from "@/lib/analysis-priority-doctrine";

const CLUSTER_CONTEXT: AnalysisPipelineContext = { scope: "evidence_cluster" };
import { logActivity } from "@/services/activity-service";
import {
  ANALYSIS_FORMAT_VERSION,
  type AuthenticityLabel,
  type ConcealedLanguageAnalysisDetail,
  type StructuredFinding,
} from "@/types/analysis";

const MAX_CHARS_PER_FILE = 12000;

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}\n\n[…truncated]`;
}

export async function runEvidenceClusterAnalysis(
  supabase: AppSupabaseClient,
  input: {
    caseId: string;
    clusterId: string;
    userId: string;
  },
): Promise<{
  finding: StructuredFinding;
  authenticityLabel: AuthenticityLabel;
  authenticityNotes?: string;
  concealedLanguageAnalysis?: ConcealedLanguageAnalysisDetail | null;
}> {
  const { caseId, clusterId, userId } = input;

  const { data: cluster, error: cErr } = await supabase
    .from("evidence_clusters")
    .select(
      `
      id,
      title,
      rationale,
      case_id,
      evidence_cluster_members (
        evidence_file_id,
        evidence_files ( id, original_filename )
      )
    `,
    )
    .eq("id", clusterId)
    .single();

  if (cErr || !cluster || (cluster.case_id as string) !== caseId) {
    throw new Error("Cluster not found");
  }

  const members = (cluster.evidence_cluster_members ?? []) as unknown as {
    evidence_file_id: string;
    evidence_files: { id: string; original_filename: string } | null;
  }[];

  const fileIds = members.map((m) => m.evidence_file_id);
  if (fileIds.length < 2) {
    const weak: StructuredFinding = {
      finding_answer:
        "This cluster has fewer than two linked files — cluster-level linkage analysis is limited.",
      evidence_basis: "Co-membership requires at least two distinct evidence items in the cluster.",
      confidence: "low",
      classification: "Uncertain",
      reasoning: "With a single file, there is nothing to compare within the cluster.",
      limitations: "Add more related evidence to the cluster or re-run file analysis with cluster hints.",
      next_step: "Link additional evidence or merge clusters after further analysis.",
    };
    let finding = normalizeStructuredFinding(weak);
    const authenticityLabel: AuthenticityLabel = "unverified";
    finding = enforceAuthenticityDiscipline(finding, authenticityLabel, "Fewer than two files in cluster.");
    finding = enforceSearchCorrelationDiscipline(finding);
    finding = enforceAliasDiscipline(finding);
    finding = enforceFindingDiscipline(finding, CLUSTER_CONTEXT);
    const structured = {
      format_version: ANALYSIS_FORMAT_VERSION,
      finding,
      authenticity_label: authenticityLabel,
      authenticity_notes: "Fewer than two files in cluster — authenticity of cross-file linkage cannot be assessed.",
    };
    const { error: upsertWeak } = await supabase.from("evidence_cluster_analyses").upsert(
      {
        cluster_id: clusterId,
        case_id: caseId,
        structured: structured as unknown as Record<string, unknown>,
        created_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "cluster_id" },
    );
    if (upsertWeak) throw new Error(upsertWeak.message);
    await logActivity(supabase, {
      caseId,
      actorId: userId,
      actorLabel: "Analyst",
      action: "cluster.analyzed",
      entityType: "evidence_cluster",
      entityId: clusterId,
      payload: { weak: true },
    });
    return {
      finding,
      authenticityLabel,
      authenticityNotes: structured.authenticity_notes,
      concealedLanguageAnalysis: null,
    };
  }

  const extracts: string[] = [];
  for (const m of members) {
    const eid = m.evidence_file_id;
    const fn = m.evidence_files?.original_filename ?? eid;
    const ex = await getExtractedText(supabase, eid);
    const raw = (ex?.raw_text as string) ?? "";
    extracts.push(`--- ${fn} ---\n${raw ? truncate(raw, MAX_CHARS_PER_FILE) : "(no extracted text)"}`);
  }

  const entities = await listEntitiesWithCategories(supabase, caseId);
  const entityBlock =
    entities.length === 0
      ? "(none)"
      : entities
          .map((e) => {
            const cats = (e.entity_categories ?? []).map((c) => c.category).join(", ");
            return `${e.label} [${e.entity_type ?? "?"}] (${cats || "no categories"})`;
          })
          .join("\n");

  const userContent = `CLUSTER TITLE: ${cluster.title ?? "(untitled)"}
CLUSTER RATIONALE (from resolver/model): ${cluster.rationale ?? "(none)"}

CASE ENTITY INDEX (may overlap with these files):
${entityBlock}

EXTRACTS BY FILE:
${extracts.join("\n\n")}
`;

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
      { role: "system", content: EVIDENCE_CLUSTER_ANALYSIS_SYSTEM },
      { role: "user", content: userContent },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty model response");

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new Error("Model did not return valid JSON");
  }

  const parsed = clusterAiModelOutputSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw new Error("Model JSON did not match the cluster analysis schema");
  }

  const {
    authenticity_label: authenticityLabel,
    authenticity_notes: authenticityNotesRaw,
    concealed_language_analysis: rawConcealed,
    ...rest
  } = parsed.data;
  const concealedLanguageAnalysis = normalizeConcealedLanguageAnalysis(rawConcealed);
  let finding = normalizeStructuredFinding(rest);
  finding = enforceAuthenticityDiscipline(finding, authenticityLabel, authenticityNotesRaw);
  finding = enforceConcealedLanguageDiscipline(finding, concealedLanguageAnalysis);
  finding = enforceSearchCorrelationDiscipline(finding);
  finding = enforceAliasDiscipline(finding);
  finding = enforceFindingDiscipline(finding, CLUSTER_CONTEXT);

  const structured = {
    format_version: ANALYSIS_FORMAT_VERSION,
    finding,
    authenticity_label: authenticityLabel,
    ...(authenticityNotesRaw ? { authenticity_notes: authenticityNotesRaw } : {}),
    ...(concealedLanguageAnalysis ? { concealed_language_analysis: concealedLanguageAnalysis } : {}),
  };

  const { error: upsertErr } = await supabase.from("evidence_cluster_analyses").upsert(
    {
      cluster_id: clusterId,
      case_id: caseId,
      structured: structured as unknown as Record<string, unknown>,
      created_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "cluster_id" },
  );

  if (upsertErr) throw new Error(upsertErr.message);

  await logActivity(supabase, {
    caseId,
    actorId: userId,
    actorLabel: "Analyst",
    action: "cluster.analyzed",
    entityType: "evidence_cluster",
    entityId: clusterId,
    payload: {},
  });

  return {
    finding,
    authenticityLabel,
    ...(authenticityNotesRaw ? { authenticityNotes: authenticityNotesRaw } : {}),
    ...(concealedLanguageAnalysis ? { concealedLanguageAnalysis } : {}),
  };
}
