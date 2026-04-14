import type { EvidenceProcessingStatus } from "@/types";

/** Visual assignment / status marker for evidence rows (see EvidenceMarkerLegend). */
export type EvidenceAssignmentMarkerKind =
  | "unassigned"
  | "in_case"
  | "multi_case"
  | "analyzed"
  | "problem";

export type EvidenceMarkerInput = {
  caseId: string | null;
  /** Rows in evidence_case_memberships for this file. */
  caseMembershipCount: number;
  processingStatus: EvidenceProcessingStatus;
  /** True when an AI analysis row exists for this file. */
  hasAiAnalysis: boolean;
};

/**
 * Priority: problem → multi-case → analyzed → in-case → unassigned.
 * "Analyzed" wins over plain "in case" when both apply.
 */
export function resolveEvidenceMarker(input: EvidenceMarkerInput): EvidenceAssignmentMarkerKind {
  const ps = input.processingStatus;
  if (ps === "blocked" || ps === "error") {
    return "problem";
  }
  if (input.caseMembershipCount > 1) {
    return "multi_case";
  }
  if (input.hasAiAnalysis) {
    return "analyzed";
  }
  if (input.caseId != null || input.caseMembershipCount > 0) {
    return "in_case";
  }
  return "unassigned";
}

export const EVIDENCE_MARKER_STYLES: Record<
  EvidenceAssignmentMarkerKind,
  { dot: string; label: string }
> = {
  unassigned: {
    dot: "bg-zinc-600 shadow-[0_0_0_1px_rgba(0,0,0,0.14)]",
    label: "Add to case",
  },
  in_case: {
    dot: "bg-sky-600 shadow-[0_0_0_1px_rgba(0,0,0,0.12)]",
    label: "On case evidence",
  },
  multi_case: {
    dot: "bg-violet-600 shadow-[0_0_0_1px_rgba(0,0,0,0.12)]",
    label: "Add to evidence stack(s)",
  },
  analyzed: {
    dot: "bg-emerald-600 shadow-[0_0_0_1px_rgba(0,0,0,0.12)]",
    label: "AI insights available — open to review",
  },
  problem: {
    dot: "bg-red-600 shadow-[0_0_0_1px_rgba(0,0,0,0.12)]",
    label: "Blocked — fix upload or review status",
  },
};
