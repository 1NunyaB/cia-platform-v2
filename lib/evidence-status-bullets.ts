import type { EvidenceProcessingStatus } from "@/types";
import { evidenceRowNeedsAnalyzing } from "@/lib/evidence-row-needs";

export type EvidenceStatusBulletKind =
  | "needs_attention"
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
};

export const EVIDENCE_STATUS_BULLET_STYLES: Record<
  EvidenceStatusBulletKind,
  { dot: string; label: string }
> = {
  needs_attention: {
    dot: "bg-red-500",
    label: "Blocked — fix upload or review status",
  },
  duplicate: {
    dot: "bg-purple-500",
    label: "Possible duplicate — compare fingerprints",
  },
  viewed: {
    dot: "bg-teal-500",
    label: "Opened before",
  },
  multi_case: {
    dot: "bg-indigo-500",
    label: "Add to evidence stack(s)",
  },
  needs_analysis: {
    dot: "bg-yellow-500",
    label: "Needs reviewing",
  },
  ai_available: {
    dot: "bg-green-500",
    label: "AI insights available — open to review",
  },
  in_case: {
    dot: "bg-blue-500",
    label: "On case evidence",
  },
  library_only: {
    dot: "bg-slate-400",
    label: "Add to case",
  },
};

/** Legend order — every kind the UI can show (MARKERS box). */
export const EVIDENCE_STATUS_BULLET_LEGEND_ORDER: EvidenceStatusBulletKind[] = [
  "needs_attention",
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
  "duplicate",
  "viewed",
  "multi_case",
  "needs_analysis",
  "ai_available",
  "in_case",
  "library_only",
];

/**
 * All applicable bullets for a row. Always includes exactly one of `in_case` or `library_only`.
 */
export function resolveEvidenceStatusBullets(input: EvidenceStatusBulletInput): EvidenceStatusBulletKind[] {
  const out: EvidenceStatusBulletKind[] = [];
  const ps = input.processingStatus;

  if (ps === "blocked" || ps === "error") {
    out.push("needs_attention");
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
