import { z } from "zod";
import type {
  IdentityBasis,
  IdentityClaimKind,
  MediaAnalysisDetail,
  MediaIdentityCertainty,
  TimestampDateStrength,
} from "@/types/analysis";

const STRENGTH_SET = new Set<string>([
  "exact_match",
  "within_12_hours",
  "same_date",
  "time_adjacent_only",
  "unclear",
  "none",
]);

const IDENTITY_SET = new Set<string>(["none", "low", "moderate", "high"]);

const BASIS_SET = new Set<string>([
  "named_in_evidence",
  "transcript_caption_or_metadata_named",
  "visual_only",
  "unnamed_unknown",
  "mixed",
]);

const CLAIM_SET = new Set<string>([
  "named_identity",
  "inferred_match",
  "possible_match",
  "visual_similarity",
  "unknown_individual",
]);

export const mediaAnalysisDetailSchema = z.object({
  visible_audible_evidence: z.string(),
  transcript_ocr_or_caption_interpreted: z.string(),
  metadata_notes: z.string(),
  timestamp_date_strength: z.string(),
  identity_certainty: z.string(),
  identity_basis: z.string().optional(),
  identity_claim_kind: z.string().optional(),
  cannot_be_confirmed: z.string(),
});

function normalizeStrength(raw: unknown): TimestampDateStrength {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (STRENGTH_SET.has(s)) return s as TimestampDateStrength;
  return "unclear";
}

function normalizeIdentity(raw: unknown): MediaIdentityCertainty {
  const s = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  if (IDENTITY_SET.has(s)) return s as MediaIdentityCertainty;
  return "none";
}

function normalizeIdentityBasis(raw: unknown): IdentityBasis {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (BASIS_SET.has(s)) return s as IdentityBasis;
  return "mixed";
}

function normalizeIdentityClaimKind(raw: unknown): IdentityClaimKind {
  const s = typeof raw === "string" ? raw.trim() : "";
  if (CLAIM_SET.has(s)) return s as IdentityClaimKind;
  return "inferred_match";
}

const PLACEHOLDER = "—";

/**
 * Coerce partial model output. Returns null if the block is empty or effectively missing.
 */
export function normalizeMediaAnalysisDetail(input: unknown): MediaAnalysisDetail | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;

  const visible = typeof o.visible_audible_evidence === "string" ? o.visible_audible_evidence.trim() : "";
  const transcript = typeof o.transcript_ocr_or_caption_interpreted === "string"
    ? o.transcript_ocr_or_caption_interpreted.trim()
    : "";
  const meta = typeof o.metadata_notes === "string" ? o.metadata_notes.trim() : "";
  const cannot = typeof o.cannot_be_confirmed === "string" ? o.cannot_be_confirmed.trim() : "";

  const ts = normalizeStrength(o.timestamp_date_strength);
  const idc = normalizeIdentity(o.identity_certainty);
  const basis = normalizeIdentityBasis(o.identity_basis);
  const claim = normalizeIdentityClaimKind(o.identity_claim_kind);

  const out: MediaAnalysisDetail = {
    visible_audible_evidence: visible.length ? visible : PLACEHOLDER,
    transcript_ocr_or_caption_interpreted: transcript.length ? transcript : PLACEHOLDER,
    metadata_notes: meta.length ? meta : PLACEHOLDER,
    timestamp_date_strength: ts,
    identity_certainty: idc,
    identity_basis: basis,
    identity_claim_kind: claim,
    cannot_be_confirmed: cannot.length ? cannot : PLACEHOLDER,
  };

  const textSubstance = [visible, transcript, meta, cannot].some((s) => s.length > 1);
  const enumSubstance =
    ts !== "unclear" || idc !== "none" || basis !== "mixed" || claim !== "inferred_match";
  if (!textSubstance && !enumSubstance) {
    return null;
  }

  return out;
}
