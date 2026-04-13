import type { EvidenceProcessingStatus } from "@/types";
import { evidenceRowNeedsAnalyzing } from "@/lib/evidence-row-needs";

export type EvidenceStatusBulletKind =
  | "needs_attention"
  | "needs_extraction"
  | "duplicate"
  | "viewed"
  | "multi_case"
  | "needs_analysis"
  | "ai_available"
  | "in_case"
  | "library_only";

export type EvidenceStatusBulletInput = {
  caseId: string | null;
  caseMembershipCount: number;
  processingStatus: EvidenceProcessingStatus;
  hasAiAnalysis: boolean;
  viewed: boolean;
  hasContentDuplicatePeer: boolean;
  extractionStatus: string | null | undefined;
};

export const EVIDENCE_STATUS_BULLET_STYLES: Record<
  EvidenceStatusBulletKind,
  { dot: string; label: string }
> = {
  needs_attention: {
    dot: "bg-red-500",
    label: "Blocked, failed, or needs attention",
  },
  needs_extraction: {
    dot: "bg-amber-500",
    label: "Needs extraction or extraction retry",
  },
  duplicate: {
    dot: "bg-purple-500",
    label: "Same file fingerprint as another item in your library",
  },
  viewed: {
    dot: "bg-teal-500",
    label: "Opened before (viewed)",
  },
  multi_case: {
    dot: "bg-indigo-500",
    label: "Linked to more than one case",
  },
  needs_analysis: {
    dot: "bg-yellow-500",
    label: "Needs AI analysis",
  },
  ai_available: {
    dot: "bg-green-500",
    label: "AI analysis available",
  },
  in_case: {
    dot: "bg-blue-500",
    label: "Included in a case",
  },
  library_only: {
    dot: "bg-slate-400",
    label: "Library only (not on a case yet)",
  },
};

/** Legend order — every kind the UI can show (MARKERS box). */
export const EVIDENCE_STATUS_BULLET_LEGEND_ORDER: EvidenceStatusBulletKind[] = [
  "needs_attention",
  "needs_extraction",
  "duplicate",
  "viewed",
  "multi_case",
  "needs_analysis",
  "ai_available",
  "in_case",
  "library_only",
];

const DISPLAY_ORDER: EvidenceStatusBulletKind[] = [
  "needs_attention",
  "needs_extraction",
  "duplicate",
  "viewed",
  "multi_case",
  "needs_analysis",
  "ai_available",
  "in_case",
  "library_only",
];

function extractionNeedsAttention(input: EvidenceStatusBulletInput): boolean {
  const ps = input.processingStatus;
  const ex = String(input.extractionStatus ?? "pending").toLowerCase();
  if (ps === "blocked" || ps === "error") return false;
  if (ps === "extracting") return true;
  if (
    ex === "failed" ||
    ex === "unavailable" ||
    ex === "retry_needed" ||
    ex === "limited" ||
    ex === "low_confidence"
  ) return true;
  if (ex === "pending" && ps !== "complete") return true;
  if (ps === "accepted") return true;
  return false;
}

/**
 * All applicable bullets for a row. Always includes exactly one of `in_case` or `library_only`.
 */
export function resolveEvidenceStatusBullets(input: EvidenceStatusBulletInput): EvidenceStatusBulletKind[] {
  const out: EvidenceStatusBulletKind[] = [];
  const ps = input.processingStatus;

  if (ps === "blocked" || ps === "error") {
    out.push("needs_attention");
  }

  if (extractionNeedsAttention(input)) {
    out.push("needs_extraction");
  }

  if (input.hasContentDuplicatePeer) {
    out.push("duplicate");
  }

  if (input.viewed) {
    out.push("viewed");
  }

  if (input.caseMembershipCount > 1) {
    out.push("multi_case");
  }

  if (
    evidenceRowNeedsAnalyzing({
      processingStatus: input.processingStatus,
      extractionStatus: input.extractionStatus,
      hasAiAnalysis: input.hasAiAnalysis,
    })
  ) {
    out.push("needs_analysis");
  }

  if (input.hasAiAnalysis) {
    out.push("ai_available");
  }

  const inCase = input.caseId != null || input.caseMembershipCount > 0;
  if (inCase) {
    out.push("in_case");
  } else {
    out.push("library_only");
  }

  const seen = new Set<EvidenceStatusBulletKind>();
  const ordered: EvidenceStatusBulletKind[] = [];
  for (const k of DISPLAY_ORDER) {
    if (out.includes(k) && !seen.has(k)) {
      seen.add(k);
      ordered.push(k);
    }
  }
  return ordered;
}
