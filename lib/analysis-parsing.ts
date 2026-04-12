import type { AiAnalysis } from "@/types";
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
import {
  normalizeStructuredFinding,
  structuredFindingSchema,
} from "@/lib/schemas/structured-finding";
import { normalizeAuthenticityLabel, normalizeAuthenticityNotes } from "@/lib/schemas/authenticity-schema";
import { normalizeMediaAnalysisDetail } from "@/lib/schemas/media-analysis-schema";
import { normalizeConcealedLanguageAnalysis } from "@/lib/schemas/concealed-language-schema";
import { normalizeRedactionAnalysisDetail } from "@/lib/schemas/redaction-analysis-schema";
import { enforceFindingDiscipline } from "@/services/analysis-finding-validation";

export type ParsedAnalysisView =
  | { kind: "v2"; finding: StructuredFinding; supplemental: StoredAnalysisStructuredV2["supplemental"] }
  | { kind: "legacy"; raw: Record<string, unknown> };

/** How analysis should be shown: always a normalized seven-field finding + supplemental graph (may be empty). */
export type AnalysisPresentation = {
  finding: StructuredFinding;
  /** True when the row is not a clean v2 record (legacy storage or malformed finding object). */
  isLegacyShell: boolean;
  supplemental: AnalysisSupplemental;
  /** Structured redaction review from newer model runs; null for legacy rows or if the model omitted the block. */
  redactionAnalysis: RedactionAnalysisDetail | null;
  /** Media/OCR/transcript structured review when present on the stored record. */
  mediaAnalysis: MediaAnalysisDetail | null;
  /** Euphemism / possible coded-language structured review when present. */
  concealedLanguageAnalysis: ConcealedLanguageAnalysisDetail | null;
  /** Provenance / integrity label; defaults to unverified for legacy rows. */
  authenticityLabel: AuthenticityLabel;
  authenticityNotes?: string;
};

function emptySupplemental(): AnalysisSupplemental {
  return {
    entities: [],
    timeline: [],
    relationships: [],
    evidence_clusters: [],
    evidence_links: [],
  };
}

function supplementalFromUnknown(raw: Record<string, unknown>): AnalysisSupplemental {
  const entities = Array.isArray(raw.entities) ? raw.entities : [];
  const timeline = Array.isArray(raw.timeline) ? raw.timeline : [];
  const relationships = Array.isArray(raw.relationships) ? raw.relationships : [];
  const evidence_clusters = Array.isArray(raw.evidence_clusters) ? raw.evidence_clusters : [];
  const evidence_links = Array.isArray(raw.evidence_links) ? raw.evidence_links : [];
  return {
    entities: entities as AnalysisSupplemental["entities"],
    timeline: timeline as AnalysisSupplemental["timeline"],
    relationships: relationships as AnalysisSupplemental["relationships"],
    evidence_clusters: evidence_clusters as NonNullable<AnalysisSupplemental["evidence_clusters"]>,
    evidence_links: evidence_links as NonNullable<AnalysisSupplemental["evidence_links"]>,
  };
}

/**
 * True if `raw` looks like a flat model payload (seven fields + graph arrays) without format_version.
 */
function looksLikeFlatFindingPayload(raw: Record<string, unknown>): boolean {
  return (
    ("finding_answer" in raw || "confidence" in raw || "classification" in raw) &&
    typeof raw.finding_answer !== "object"
  );
}

function legacyFindingFromRow(analysis: AiAnalysis, raw: Record<string, unknown>): StructuredFinding {
  const summary = String(analysis.summary ?? "").trim();
  const redaction = analysis.redaction_notes?.trim();

  if (looksLikeFlatFindingPayload(raw)) {
    return enforceFindingDiscipline(
      normalizeStructuredFinding({
        finding_answer: raw.finding_answer,
        evidence_basis: raw.evidence_basis,
        confidence: raw.confidence,
        classification: raw.classification,
        reasoning: raw.reasoning,
        limitations: raw.limitations,
        next_step: raw.next_step,
      }),
    );
  }

  const limitationsParts = [
    "This analysis predates strict seven-field structured storage.",
    summary ? "" : "No summary text was stored on this record.",
    redaction ? `Redaction / sensitivity notes: ${redaction}` : "",
  ].filter(Boolean);

  return enforceFindingDiscipline(
    normalizeStructuredFinding({
      finding_answer:
        summary ||
        "Legacy analysis record — no summary text was stored. See supplemental tabs and raw JSON if available.",
      evidence_basis:
        "Evidence basis was not captured separately for this legacy row; refer to extracted text and supplemental sections.",
      confidence: "low",
      classification: "Uncertain",
      reasoning:
        "The system previously surfaced a free-form summary as the primary result. All seven fields are shown for consistency; values here are reconstructed from legacy data.",
      limitations: limitationsParts.join(" "),
      next_step: "Re-run AI analysis on this evidence to replace legacy data with a full structured finding.",
    }),
  );
}

/**
 * Unified presentation for any stored analysis row: always seven normalized fields first in the UI.
 */
export function resolveAnalysisPresentation(analysis: AiAnalysis): AnalysisPresentation {
  const structured = analysis.structured;
  if (structured && typeof structured === "object") {
    const s = structured as Record<string, unknown>;
    if (s.format_version === ANALYSIS_FORMAT_VERSION && s.finding && typeof s.finding === "object") {
      const parsed = structuredFindingSchema.safeParse(s.finding);
      const finding = enforceFindingDiscipline(
        normalizeStructuredFinding(parsed.success ? parsed.data : s.finding),
      );
      const supplementalRaw = (s as StoredAnalysisStructuredV2).supplemental;
      const supplemental: AnalysisSupplemental = supplementalRaw
        ? { ...emptySupplemental(), ...supplementalRaw }
        : emptySupplemental();
      const ra = (s as StoredAnalysisStructuredV2).redaction_analysis;
      const redactionAnalysis = normalizeRedactionAnalysisDetail(ra ?? null);
      const mediaAnalysis = normalizeMediaAnalysisDetail((s as StoredAnalysisStructuredV2).media_analysis ?? null);
      const concealedLanguageAnalysis = normalizeConcealedLanguageAnalysis(
        (s as StoredAnalysisStructuredV2).concealed_language_analysis ?? null,
      );
      const authenticityLabel = normalizeAuthenticityLabel((s as StoredAnalysisStructuredV2).authenticity_label);
      const authenticityNotes = normalizeAuthenticityNotes((s as StoredAnalysisStructuredV2).authenticity_notes);
      return {
        finding,
        isLegacyShell: !parsed.success,
        supplemental,
        redactionAnalysis,
        mediaAnalysis,
        concealedLanguageAnalysis,
        authenticityLabel,
        authenticityNotes,
      };
    }

    const raw = s;
    const finding = legacyFindingFromRow(analysis, raw);
    return {
      finding,
      isLegacyShell: true,
      supplemental: supplementalFromUnknown(raw),
      redactionAnalysis: null,
      mediaAnalysis: null,
      concealedLanguageAnalysis: null,
      authenticityLabel: "unverified",
      authenticityNotes: undefined,
    };
  }

  const finding = legacyFindingFromRow(analysis, {});
  return {
    finding,
    isLegacyShell: true,
    supplemental: emptySupplemental(),
    redactionAnalysis: null,
    mediaAnalysis: null,
    concealedLanguageAnalysis: null,
    authenticityLabel: "unverified",
    authenticityNotes: undefined,
  };
}

/** @deprecated Prefer resolveAnalysisPresentation — kept for callers that branch on v2 vs legacy only. */
export function parseAnalysisForView(analysis: AiAnalysis | null): ParsedAnalysisView | null {
  if (!analysis?.structured || typeof analysis.structured !== "object") {
    return null;
  }
  const s = analysis.structured as Record<string, unknown>;
  if (s.format_version === ANALYSIS_FORMAT_VERSION && s.finding && typeof s.finding === "object") {
    const parsedFinding = structuredFindingSchema.safeParse(s.finding);
    if (parsedFinding.success) {
      const supplemental = (s as StoredAnalysisStructuredV2).supplemental;
      return {
        kind: "v2",
        finding: enforceFindingDiscipline(normalizeStructuredFinding(parsedFinding.data)),
        supplemental,
      };
    }
  }
  return { kind: "legacy", raw: s };
}
