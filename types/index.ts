import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContextualTimeInference, TimelineKind, TimelineTier } from "@/types/analysis";

export type CaseVisibility = "private" | "team" | "public";
export type CaseMemberRole = "owner" | "admin" | "contributor" | "viewer";
export type EvidenceProcessingStatus =
  | "pending"
  | "scanning"
  | "accepted"
  | "blocked"
  | "extracting"
  | "analyzing"
  | "complete"
  | "error";
export type ExtractionMethod = "plain_text" | "pdf_text" | "ocr_pending" | "ocr";
export type ContributionKind =
  | "note"
  | "comment"
  | "evidence_upload"
  | "analysis_run"
  | "invite";

export type {
  AnalysisClassification,
  AnalysisConfidence,
  AnalysisSupplemental,
  AuthenticityLabel,
  ClusterAnalysisView,
  ConcealedLanguageAnalysisDetail,
  ConcealedLanguageFlaggedPhrase,
  ConcealedLanguageUsageStrength,
  ContextualTimeInference,
  IdentityBasis,
  IdentityClaimKind,
  InvestigationCategorySlug,
  MediaAnalysisDetail,
  StoredAnalysisStructuredV2,
  StructuredFinding,
  SupplementalEntity,
  SupplementalEvidenceCluster,
  SupplementalEvidenceLink,
  SupplementalRelationship,
  SupplementalTimelineEvent,
  TimestampDateStrength,
  TimelineKind,
  TimelineTier,
  TimelineTimingBasis,
} from "@/types/analysis";
export {
  AUTHENTICITY_LABEL_DISPLAY,
  CONCEALED_USAGE_STRENGTH_LABELS,
  IDENTITY_BASIS_LABELS,
  IDENTITY_CLAIM_KIND_LABELS,
  TIMELINE_KIND_ACCENT,
  TIMELINE_KIND_BG,
  TIMELINE_KIND_LABELS,
  TIMESTAMP_DATE_STRENGTH_LABELS,
} from "@/types/analysis";
export {
  ANALYSIS_CLASSIFICATION_LABELS,
  ANALYSIS_FORMAT_VERSION,
  isAnalysisClassification,
  normalizeClassification,
} from "@/types/analysis";

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type CaseRow = {
  id: string;
  title: string;
  description: string | null;
  visibility: CaseVisibility;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type CaseMember = {
  id: string;
  case_id: string;
  user_id: string;
  role: CaseMemberRole;
  invited_by: string | null;
  created_at: string;
};

export type EvidenceFile = {
  id: string;
  /** Null while the file lives in the uploader's library before case assignment. */
  case_id: string | null;
  uploaded_by: string;
  storage_path: string;
  original_filename: string;
  mime_type: string | null;
  file_size: number | null;
  processing_status: EvidenceProcessingStatus;
  error_message: string | null;
  created_at: string;
  /** Case-scoped sequence; stable after creation. */
  file_sequence_number?: number;
  /** Stable display label (stem__NNN); original_filename remains the upload name. */
  display_filename?: string | null;
  /** Stable human-readable reference (e.g. Clinton67). */
  short_alias?: string | null;
  alias_seed?: string | null;
  alias_seed_type?: string | null;
  /** SHA-256 hex of file bytes at upload; used for duplicate detection. */
  content_sha256?: string | null;
};

export type ExtractedText = {
  id: string;
  evidence_file_id: string;
  raw_text: string | null;
  extraction_method: ExtractionMethod;
  created_at: string;
  /** 0 = full-document text layer; 1+ = OCR page. Omitted when rows are merged for display. */
  page_number?: number;
  confidence?: number | null;
  /** When `getExtractedText` merges multiple DB rows for one file. */
  page_count?: number;
};

export type AiAnalysis = {
  id: string;
  evidence_file_id: string;
  summary: string | null;
  redaction_notes: string | null;
  model: string | null;
  structured: Record<string, unknown> | null;
  /** Denormalized mirror of structured finding + inquiry metadata */
  analysis_kind?: string | null;
  inquiry_prompt?: string | null;
  full_response_json?: Record<string, unknown> | null;
  finding_answer?: string | null;
  confidence_label?: string | null;
  classification?: string | null;
  reasoning?: string | null;
  limitations?: string | null;
  suggested_next_steps?: string | null;
  created_at: string;
  updated_at: string;
};

export type EntityRow = {
  id: string;
  case_id: string;
  evidence_file_id: string | null;
  ai_analysis_id: string | null;
  label: string;
  entity_type: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export type TimelineEventRow = {
  id: string;
  case_id: string;
  evidence_file_id: string | null;
  ai_analysis_id: string | null;
  occurred_at: string | null;
  title: string;
  summary: string | null;
  created_at: string;
  timeline_tier?: TimelineTier | null;
  timeline_kind?: TimelineKind | null;
  source_label?: string | null;
  event_classification?: string | null;
  event_reasoning?: string | null;
  event_limitations?: string | null;
  contextual_time_inference?: ContextualTimeInference | null;
};

export type RelationshipRow = {
  id: string;
  case_id: string;
  evidence_file_id: string | null;
  ai_analysis_id: string | null;
  source_entity_id: string | null;
  target_entity_id: string | null;
  relation_type: string | null;
  description: string | null;
  created_at: string;
};

export type NoteRow = {
  id: string;
  case_id: string;
  evidence_file_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
  updated_at: string;
};

export type CommentRow = {
  id: string;
  case_id: string;
  evidence_file_id: string | null;
  note_id: string | null;
  author_id: string;
  body: string;
  created_at: string;
};

export type ActivityRow = {
  id: string;
  case_id: string;
  actor_id: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

/** Typed Supabase client for this schema (narrow where needed). */
export type AppSupabaseClient = SupabaseClient;
