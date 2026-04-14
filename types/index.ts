import type { SupabaseClient } from "@supabase/supabase-js";
import type { ContextualTimeInference, TimelineKind, TimelineTier } from "@/types/analysis";

/** Stored on each row for RLS; new cases are always `"public"` (shared investigations). */
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

/** Stored on `profiles`; opt-in persona for the Investigators wall and in-app stamps. */
export type InvestigatorPersonaFields = {
  investigator_opt_in: boolean;
  investigator_alias: string | null;
  investigator_avatar_url: string | null;
  investigator_tagline: string | null;
};

export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
} & Partial<InvestigatorPersonaFields>;

/** Extraction outcome on `evidence_files` (orthogonal to `processing_status` in several paths). */
export type EvidenceExtractionStatus =
  | "pending"
  | "ok"
  | "failed"
  | "unavailable"
  | "retry_needed"
  | "limited"
  | "low_confidence";

export type CaseRow = {
  id: string;
  title: string;
  description: string | null;
  visibility: CaseVisibility;
  created_by: string;
  created_at: string;
  updated_at: string;
  /** Structured incident fields (nullable for legacy rows). */
  incident_year?: number | null;
  incident_city?: string | null;
  incident_state?: string | null;
  accused_label?: string | null;
  victim_labels?: string | null;
  known_weapon?: string | null;
};

export type CaseMember = {
  id: string;
  case_id: string;
  user_id: string;
  role: CaseMemberRole;
  invited_by: string | null;
  created_at: string;
};

/** Ingest path for internal audit (`evidence_upload_audit`); not shown on default evidence surfaces. */
export type EvidenceUploadMethod =
  | "single_file"
  | "bulk"
  | "url_import"
  | "derivative_crop"
  | "derivative_pdf_page";

/** Internal audit row — RLS blocks SELECT for authenticated users; inspect via service_role / admin tooling. */
export type EvidenceUploadAuditRow = {
  evidence_file_id: string;
  uploaded_by: string | null;
  guest_session_id?: string | null;
  uploader_ip: string | null;
  user_agent: string | null;
  upload_method: EvidenceUploadMethod | null;
  created_at: string;
};

export type EvidenceFile = {
  id: string;
  /** Null while the file lives in the uploader's library before case assignment. */
  case_id: string | null;
  /** Signed-in uploader; null for guest-owned library rows (see guest_session_id). */
  uploaded_by: string | null;
  /** Anonymous session owner when uploaded_by is null. */
  guest_session_id?: string | null;
  storage_path: string;
  original_filename: string;
  mime_type: string | null;
  file_size: number | null;
  processing_status: EvidenceProcessingStatus;
  error_message: string | null;
  /** Text extraction outcome; file may still be stored when not `ok`. */
  extraction_status?: EvidenceExtractionStatus | string | null;
  extraction_user_message?: string | null;
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
  /** Heuristic kind from MIME/filename at upload (separate from case stacks). */
  suggested_evidence_kind?: string | null;
  /** User-confirmed kind after review; null until confirmed. */
  confirmed_evidence_kind?: string | null;
  evidence_kind_confirmed_at?: string | null;
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
