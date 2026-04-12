import type { StructuredFinding } from "@/types/analysis";

/** Tier from overlap heuristics (not model certainty). */
export type ClusterAdvisoryTier = "high" | "medium" | "low";

export type ClusterSuggestion = {
  clusterId: string;
  title: string | null;
  rationale: string | null;
  /** Combined score 0–1 from entity overlap, cross-links, and text overlap. */
  score: number;
  tier: ClusterAdvisoryTier;
  /** Evidence-style bullets (shared entities, links, text overlap, dates/locations if detected). */
  reasons: string[];
  autoLinked: boolean;
};

export type EvidenceCollaborationSnapshot = {
  /** Rows in activity_log for this evidence open (includes current session). */
  openEventCount: number;
  /** Distinct human viewers (by actor_id when present). */
  distinctViewerCount: number;
  viewerNames: string[];
  hasStickies: boolean;
  hasComments: boolean;
  hasFormalNotes: boolean;
  entityMentionCount: number;
  timelineEventLinkCount: number;
  crossEvidenceLinkCount: number;
};

export type EvidenceIntelligenceResult = {
  /** Seven-field advisory (Correlated by default; discipline-enforced). */
  finding: StructuredFinding;
  existingClusters: { id: string; title: string | null; rationale: string | null }[];
  suggestions: ClusterSuggestion[];
  /** Clusters the system just added this file to (high confidence path). */
  autoLinked: { clusterId: string; title: string | null; score: number; rationale: string }[];
  collaboration: EvidenceCollaborationSnapshot;
};
