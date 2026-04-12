/** Structured finding — required for all v2 analysis records (`structured.format_version === 2`). */
export type AnalysisConfidence = "high" | "medium" | "low";

/**
 * Allowed classification labels (exact strings — enforced in Zod, normalization, and UI).
 *
 * - Confirmed — directly supported by visible, audible, or unredacted evidence (not from guessing hidden text)
 * - Inferred — supported by multiple clues or patterns, but not directly stated
 * - Reconstructed — context-based fill or explanatory replacement, not original recovered text
 * - Uncertain — possible, but too weak, incomplete, or conflicting to rely on
 * - Correlated — related evidence of different types points toward a meaningful connection, but not enough for Confirmed or Conclusive
 * - Conclusive — only when the information is unredacted, directly supported, and verifiable from the available evidence; never based on redacted spans or inferred “recovery” of hidden wording
 */
export const ANALYSIS_CLASSIFICATION_LABELS = [
  "Confirmed",
  "Inferred",
  "Reconstructed",
  "Uncertain",
  "Correlated",
  "Conclusive",
] as const;

export type AnalysisClassification = (typeof ANALYSIS_CLASSIFICATION_LABELS)[number];

const CLASSIFICATION_SET = new Set<string>(ANALYSIS_CLASSIFICATION_LABELS);

/** True only for one of the six allowed labels (exact match). */
export function isAnalysisClassification(value: unknown): value is AnalysisClassification {
  return typeof value === "string" && CLASSIFICATION_SET.has(value);
}

/** Invalid or missing values become Uncertain (safe default). */
export function normalizeClassification(value: unknown): AnalysisClassification {
  return isAnalysisClassification(value) ? value : "Uncertain";
}

export type StructuredFinding = {
  finding_answer: string;
  evidence_basis: string;
  confidence: AnalysisConfidence;
  classification: AnalysisClassification;
  reasoning: string;
  limitations: string;
  next_step: string;
};

export const ANALYSIS_FORMAT_VERSION = 2 as const;

/**
 * Evidence authenticity — independent from analytical classification (e.g. Confirmed + Unverified is allowed).
 */
export type AuthenticityLabel =
  | "verified_by_source"
  | "strongly_corroborated"
  | "likely_authentic"
  | "unverified"
  | "inconsistent"
  | "potentially_manipulated";

export const AUTHENTICITY_LABEL_DISPLAY: Record<AuthenticityLabel, string> = {
  verified_by_source: "Verified by Source",
  strongly_corroborated: "Strongly Corroborated",
  likely_authentic: "Likely Authentic",
  unverified: "Unverified",
  inconsistent: "Inconsistent",
  potentially_manipulated: "Potentially Manipulated",
};

/** Persisted on `timeline_events` and optionally denormalized onto supplemental timeline rows. */
export type TimelineTier = "t1_confirmed" | "t2_supported" | "t3_leads";

export const TIMELINE_TIER_LABELS: Record<TimelineTier, string> = {
  t1_confirmed: "Timeline 1 — Confirmed",
  t2_supported: "Timeline 2 — Supported",
  t3_leads: "Timeline 3 — Leads",
};

/**
 * Parallel investigation timelines — events are not merged across kinds by default.
 * Must match `timeline_kind` enum in the database.
 */
export type TimelineKind =
  | "witness"
  | "subject_actor"
  | "official"
  | "evidence"
  | "reconstructed"
  | "custom";

export const TIMELINE_KIND_LABELS: Record<TimelineKind, string> = {
  witness: "Witness Timeline",
  subject_actor: "Subject / Actor Timeline",
  official: "Official Timeline",
  evidence: "Evidence Timeline",
  reconstructed: "Reconstructed Timeline",
  custom: "Custom Timeline",
};

/** Left-border color for timeline lanes (pair with `border-l-4`). */
export const TIMELINE_KIND_ACCENT: Record<TimelineKind, string> = {
  witness: "border-l-violet-500/80",
  subject_actor: "border-l-rose-500/80",
  official: "border-l-sky-500/80",
  evidence: "border-l-emerald-500/80",
  reconstructed: "border-l-amber-500/80",
  custom: "border-l-cyan-500/80",
};

/** Lane marker dots / bars in lists. */
export const TIMELINE_KIND_BG: Record<TimelineKind, string> = {
  witness: "bg-violet-500/80",
  subject_actor: "bg-rose-500/80",
  official: "bg-sky-500/80",
  evidence: "bg-emerald-500/80",
  reconstructed: "bg-amber-500/80",
  custom: "bg-cyan-500/80",
};

/** Must match `investigation_category` enum and `INVESTIGATION_CATEGORY_SLUGS` in lib. */
export type InvestigationCategorySlug =
  | "core_actors"
  | "money"
  | "political"
  | "tech"
  | "intel"
  | "convicted"
  | "accusers"
  | "accused"
  | "victims"
  | "dead";

/**
 * Strength of a concealed-language signal (drives conservative classification rules server-side).
 */
export type ConcealedLanguageUsageStrength =
  | "ordinary_likely"
  | "isolated_unusual"
  | "repeated_within_source"
  | "repeated_cross_source";

export const CONCEALED_USAGE_STRENGTH_LABELS: Record<ConcealedLanguageUsageStrength, string> = {
  ordinary_likely: "Ordinary usage likely",
  isolated_unusual: "Isolated unusual usage",
  repeated_within_source: "Repeated within this source",
  repeated_cross_source: "Repeated across case sources (verify)",
};

/**
 * One flagged term — field names align with investigator UI labels.
 */
export type ConcealedLanguageFlaggedPhrase = {
  flagged_phrase: string;
  why_it_was_flagged: string;
  where_it_appears: string;
  occurrence_summary: string;
  /** Entities, dates, places, events, transactions, people near the phrase (as stated in evidence). */
  surrounding_context: string;
  ordinary_vs_suspicious: string;
  /** Repetition within file / cross-file when supported by extract + same-run supplemental hints. */
  repeated_usage: string;
  possible_non_literal_meaning: string;
  what_cannot_be_determined: string;
  usage_strength: ConcealedLanguageUsageStrength;
};

/**
 * Optional structured review for euphemisms, substitutions, or possible coded phrasing (per evidence analysis run).
 */
export type ConcealedLanguageAnalysisDetail = {
  overview: string;
  case_only_scope_note: string;
  conservative_summary: string;
  flagged_phrases: ConcealedLanguageFlaggedPhrase[];
};

/** Parsed cluster analysis for case UI (v2 stored shape or legacy flat finding). */
export type ClusterAnalysisView = {
  finding: StructuredFinding;
  authenticityLabel: AuthenticityLabel;
  authenticityNotes?: string;
  concealedLanguageAnalysis?: ConcealedLanguageAnalysisDetail | null;
};

/** Optional structured redaction review (per evidence analysis run). */
export type RedactionAnalysisDetail = {
  /** What can be read around redactions / placeholders in the extract. */
  visible_context: string;
  /** Whether missing text changes how a reader should interpret the visible material. */
  redacted_portion_impact: string;
  /** Tentative interpretation from context only — not claimed as original hidden wording. */
  likely_meaning: string;
  /** Limits of the extract (what cannot be known from visible text alone). */
  what_cannot_be_determined: string;
  /** Whether similar wording appears elsewhere unredacted in the extract or case context described in the prompt. */
  unredacted_elsewhere_note: string;
  /** Required caution when interpretation is context-based, not literal recovery. */
  context_interpretation_warning: string;
};

/**
 * Time alignment strength for media — categories must not be merged or treated as equivalent.
 * - exact_match — same event with direct timestamp or clearly verifiable alignment
 * - within_12_hours — strong proximity, not exact same moment
 * - same_date — calendar date only
 * - time_adjacent_only — loose adjacency without firm clock/calendar anchor
 */
export type TimestampDateStrength =
  | "exact_match"
  | "within_12_hours"
  | "same_date"
  | "time_adjacent_only"
  | "unclear"
  | "none";

export const TIMESTAMP_DATE_STRENGTH_LABELS: Record<TimestampDateStrength, string> = {
  exact_match: "Exact match — verifiable same event/time",
  within_12_hours: "Within 12 hours — strong proximity, not exact",
  same_date: "Same calendar date only — no precise time lock",
  time_adjacent_only: "Time-adjacent only — no firm anchor",
  unclear: "Unclear",
  none: "No usable time anchor",
};

export type MediaIdentityCertainty = "none" | "low" | "moderate" | "high";

/**
 * How a person-related label is supported — Confirmed identity (person) requires explicit naming in evidence
 * (text, transcript, caption, or metadata), not visual-only.
 */
export type IdentityBasis =
  | "named_in_evidence"
  | "transcript_caption_or_metadata_named"
  | "visual_only"
  | "unnamed_unknown"
  | "mixed";

/**
 * What the analysis is asserting about identity — keeps "possible match" and "named" distinct.
 */
export type IdentityClaimKind =
  | "named_identity"
  | "inferred_match"
  | "possible_match"
  | "visual_similarity"
  | "unknown_individual";

export const IDENTITY_BASIS_LABELS: Record<IdentityBasis, string> = {
  named_in_evidence: "Named in extract (text body)",
  transcript_caption_or_metadata_named: "Named in transcript, caption, or metadata",
  visual_only: "Visual / audible only — no explicit name in text layers",
  unnamed_unknown: "Unnamed or unknown individual",
  mixed: "Mixed sources",
};

export const IDENTITY_CLAIM_KIND_LABELS: Record<IdentityClaimKind, string> = {
  named_identity: "Named identity",
  inferred_match: "Inferred match",
  possible_match: "Possible match",
  visual_similarity: "Visual similarity / consistent features",
  unknown_individual: "Unknown individual",
};

/**
 * Optional structured media review (per evidence analysis run when file is image/video/audio or OCR-heavy).
 * Separates direct visible/audible claims from transcript/OCR/metadata-based inference.
 */
export type MediaAnalysisDetail = {
  visible_audible_evidence: string;
  transcript_ocr_or_caption_interpreted: string;
  metadata_notes: string;
  timestamp_date_strength: TimestampDateStrength;
  identity_certainty: MediaIdentityCertainty;
  /** Whether an explicit name exists in text/transcript/caption/metadata vs visual-only. */
  identity_basis: IdentityBasis;
  /** Nature of the identity claim (possible match vs named, etc.). */
  identity_claim_kind: IdentityClaimKind;
  cannot_be_confirmed: string;
};

/** Persisted shape in `ai_analyses.structured` for v2 analyses. */
export type StoredAnalysisStructuredV2 = {
  format_version: typeof ANALYSIS_FORMAT_VERSION;
  finding: StructuredFinding;
  supplemental?: AnalysisSupplemental;
  /** Present when the model returned the redaction block; older rows may omit. */
  redaction_analysis?: RedactionAnalysisDetail;
  /** Present for media-class runs; normalized server-side. */
  media_analysis?: MediaAnalysisDetail | null;
  /** Chain-of-custody / provenance assessment; independent from classification (omit on legacy rows → treat as unverified). */
  authenticity_label?: AuthenticityLabel;
  /** Brief evaluation (source, metadata, corroboration, integrity, contradictions). */
  authenticity_notes?: string;
  /** Euphemism / possible coded-language review; normalized server-side. */
  concealed_language_analysis?: ConcealedLanguageAnalysisDetail | null;
};

export type AnalysisSupplemental = {
  entities: SupplementalEntity[];
  timeline: SupplementalTimelineEvent[];
  relationships: SupplementalRelationship[];
  /** Grouped evidence clusters (filenames resolved server-side to evidence IDs). */
  evidence_clusters?: SupplementalEvidenceCluster[];
  /** Explicit pairwise links between evidence files in the same case. */
  evidence_links?: SupplementalEvidenceLink[];
};

/** Strength of an alias link — weak matches must not be auto-merged without corroboration. */
export type EntityAliasStrength = "weak" | "moderate" | "strong";

/** Model-proposed alternate names for the same canonical entity row (never replaces primary label). */
export type SupplementalEntityAlias = {
  alias: string;
  strength?: EntityAliasStrength;
  /** Brief extract-based basis when available. */
  basis?: string;
};

export type SupplementalEntity = {
  label: string;
  /** Freeform type string from the model (person, org, place, …) — not a category. */
  entity_type: string;
  /** Category slugs from the model (normalized on persist). */
  categories: string[];
  mentions?: { snippet: string }[];
  /** Alternate spellings, nicknames, initials, AKA — only when supported in the extract. */
  aliases?: SupplementalEntityAlias[];
};

/** What kind of external anchor was used for contextual time placement (holidays, known events, media, etc.). */
export type ContextualTimeInferenceReferenceType =
  | "holiday"
  | "public_event"
  | "media_event"
  | "cross_evidence_pattern"
  | "other";

/**
 * One candidate window when mapping a reference to calendar time.
 * When multiple plausible windows exist, list them — do not collapse to a single guess in limitations text.
 */
export type ContextualTimeWindow = {
  /** ISO date, YYYY-MM, or human-readable bounds */
  start?: string | null;
  end?: string | null;
  /** e.g. "US Thanksgiving weekend 2020" */
  label?: string;
};

/**
 * Structured audit trail for timing inferred from holidays, public or media events, or repeated cross-evidence cues.
 * Required when `timing_basis` is `contextual_inference` or when inferring dates not verbatim in the extract.
 */
export type ContextualTimeInference = {
  reference_type: ContextualTimeInferenceReferenceType;
  /** What holiday, election, broadcast, repeated motif, etc. */
  reference_description: string;
  /** How the reference maps to calendar time; use multiple entries when ambiguity remains. */
  time_windows: ContextualTimeWindow[];
  /** True when a calendar year is anchored by evidence (not guessed). */
  year_known: boolean;
  /** True when the year is assumed without direct documentary support. */
  year_assumed?: boolean;
  /** What cannot be concluded; include uncertainty when the year is unknown. */
  limitations: string;
  /** How text or cross-file references support the window(s). */
  inference_explanation: string;
  /**
   * `specific_known_year` — a single defensible year/window (e.g. "Thanksgiving 2019" with year in text).
   * `vague_or_ambiguous` — weak cues; cap timeline tier to Leads.
   * `multiple_possible_windows` — list alternatives in time_windows; do not pick one arbitrarily.
   */
  specificity: "specific_known_year" | "vague_or_ambiguous" | "multiple_possible_windows";
};

/** Whether occurred_at comes from the extract verbatim, from contextual inference, or both. */
export type TimelineTimingBasis = "direct_evidence" | "contextual_inference" | "mixed";

/** Optional model hint for timeline tier (1–3); persisted tier on `timeline_events` is computed in `resolveTimelineTier`. */
export type SupplementalTimelineEvent = {
  occurred_at?: string | null;
  title: string;
  summary?: string;
  /**
   * Which parallel timeline this event belongs to. Analysis-derived rows default to `evidence` when omitted.
   */
  timeline_kind?: TimelineKind;
  /** Who or what is the source of the event (document, witness, agency, etc.). */
  source_label?: string;
  /** Per-event classification (e.g. Confirmed / Inferred) — distinct from the main finding when needed. */
  event_classification?: string;
  /** Why this time and description are assigned. */
  event_reasoning?: string;
  /** Caveats, gaps, or dependency on inference techniques (shadow analysis, anchoring, etc.). */
  event_limitations?: string;
  /** Additional evidence files that support this event (original filenames in this case). */
  supporting_evidence_filenames?: string[];
  /**
   * When dates are anchored to holidays, elections, televised events, or known media — set `contextual_inference`
   * and fill `contextual_time_inference`. Omit when the extract states an explicit date/time directly.
   */
  timing_basis?: TimelineTimingBasis;
  contextual_time_inference?: ContextualTimeInference;
  /** Optional; server may ignore if it violates classification caps. */
  timeline_tier?: number | string;
  /** Set when analysis is persisted — canonical tier after classification + evidence rules. */
  timeline_tier_resolved?: TimelineTier;
  /** Set when analysis is persisted — canonical lane after normalization. */
  timeline_kind_resolved?: TimelineKind;
  /**
   * Per-event provenance (optional in model output). After persist, defaults to the parent analysis
   * `authenticity_label` when omitted; stored on `timeline_events.authenticity_label`.
   */
  authenticity_label?: AuthenticityLabel;
};

export type SupplementalRelationship = {
  source_label: string;
  target_label: string;
  relation_type: string;
  description?: string;
};

/** Distinguishes identity/alias-driven groupings from general thematic clusters (UI + traceability). */
export type EvidenceClusterKind = "standard" | "alias_focused";

export type SupplementalEvidenceCluster = {
  title?: string;
  rationale?: string;
  /**
   * Optional filename hints from the model (metadata only). Server resolves members primarily from
   * shared entities, contacts, dates, and text overlap across extracted evidence in the case.
   */
  evidence_filenames?: string[];
  /** When the cluster is primarily about linking materials via shared aliases or resolved identity markers. */
  cluster_kind?: EvidenceClusterKind;
};

export type SupplementalEvidenceLink = {
  /** Optional upload filename hint — not required; links resolve from shared content when absent. */
  target_evidence_filename?: string;
  link_type?: string;
  description?: string;
};
