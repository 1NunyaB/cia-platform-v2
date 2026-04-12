import type { CaseInvestigationActionKind } from "@/prompts/investigation-case-actions";

/**
 * Investigation Actions — final labels and wiring for the case workspace.
 * `status`: available | partial | planned
 * `intent`: optional query for `/evidence/[id]` to show guided context (same structured AI pipeline).
 * `caseAnalysisAction`: when set, the panel POSTs to `/api/cases/[caseId]/investigation-action` (no navigation).
 */
export type InvestigationActionStatus = "available" | "partial" | "planned";

export type InvestigationActionItem = {
  id: string;
  label: string;
  /** Shown in UI under label; also used as `title` for hover tooltip */
  hover: string;
  status: InvestigationActionStatus;
  href?: string;
  /** Passed as `?intent=` when opening evidence analysis */
  intent?: string;
  /** Runs case-level structured analysis instead of navigating (see investigation-actions-panel). */
  caseAnalysisAction?: CaseInvestigationActionKind;
  /**
   * If case-level analysis fails, the panel may offer a link built with `resolveHref` (same shape as `href` + `intent`).
   */
  caseAnalysisFallback?: { href: NonNullable<InvestigationActionItem["href"]>; intent?: string };
};

export type InvestigationActionGroup = {
  id: "search" | "compare" | "analyze" | "build";
  /** Category heading shown in UI */
  sectionTitle: string;
  /** Short line under the heading */
  sectionSubtitle: string;
  actions: InvestigationActionItem[];
};

export const INVESTIGATION_ACTION_GROUPS: InvestigationActionGroup[] = [
  {
    id: "search",
    sectionTitle: "Find Information",
    sectionSubtitle:
      "Case-scoped first. Entity and timeline filters use your keywords; stronger matches (exact text in extracts) rank above loose fuzzy hits when full search ships.",
    actions: [
      {
        id: "find-name",
        label: "Find by Name",
        hover: "Open the entity list and filter by person or organization name.",
        status: "available",
        href: "entities",
      },
      {
        id: "find-date",
        label: "Find by Date",
        hover: "Open the timeline and filter by date text or event wording.",
        status: "available",
        href: "timeline",
      },
      {
        id: "find-email",
        label: "Find by Email",
        hover: "Match email-like text in entity labels and timeline (full index search planned).",
        status: "partial",
        href: "entities",
      },
      {
        id: "find-username",
        label: "Find by Username",
        hover: "Match handle or username text in stored entities and events.",
        status: "partial",
        href: "entities",
      },
      {
        id: "find-location",
        label: "Find by Location",
        hover: "Match place names and location wording in entities and events.",
        status: "partial",
        href: "entities",
      },
      {
        id: "find-event",
        label: "Find by Event",
        hover: "Filter timeline events by title, summary, or date string.",
        status: "available",
        href: "timeline",
      },
      {
        id: "find-object",
        label: "Find by Object",
        hover: "Match object or thing references in entity labels (broader search planned).",
        status: "partial",
        href: "entities",
      },
    ],
  },
  {
    id: "compare",
    sectionTitle: "Compare Evidence",
    sectionSubtitle:
      "Cross-check using case evidence, clusters, and links — structured AI ranks exact and direct cues above weak pattern similarity.",
    actions: [
      {
        id: "cmp-documents",
        label: "Compare Documents",
        hover: "Open files in separate tabs today; dedicated diff and multi-select compare coming soon.",
        status: "planned",
      },
      {
        id: "cmp-statements",
        label: "Compare Statements",
        hover: "Written statement diff and alignment — planned.",
        status: "planned",
      },
      {
        id: "cmp-media",
        label: "Compare Media (Audio / Video)",
        hover: "Synchronized media review — planned.",
        status: "planned",
      },
      {
        id: "cmp-timelines",
        label: "Compare Timelines",
        hover: "View the case timeline; overlay compare planned.",
        status: "partial",
        href: "timeline",
      },
      {
        id: "cmp-cross",
        label: "Cross-Check Evidence",
        hover: "Use evidence links, clusters, and per-file AI analysis for cautious cross-type checks.",
        status: "partial",
        href: "clusters",
      },
    ],
  },
  {
    id: "analyze",
    sectionTitle: "Analyze Evidence",
    sectionSubtitle: "Structured seven-field findings: same pipeline for every analysis — conservative and evidence-first.",
    actions: [
      {
        id: "an-explain",
        label: "Explain Relevance",
        hover: "Runs structured AI on extracted text: Finding, Evidence Basis, Confidence, Classification, Reasoning, Limitations, Next Step.",
        status: "partial",
        caseAnalysisAction: "explain_relevance",
        caseAnalysisFallback: { href: "evidence-first", intent: "explain_relevance" },
      },
      {
        id: "an-redact",
        label: "Analyze Redactions",
        hover: "Same analysis pipeline; never claims exact recovery of redacted text — see limitations in output.",
        status: "partial",
        href: "evidence-first",
        intent: "redactions",
      },
      {
        id: "an-interpret",
        label: "Interpret Likely Meaning (Cautious)",
        hover: "Inference stays labeled (e.g. Inferred / Uncertain); open a file and run analysis.",
        status: "partial",
        href: "evidence-first",
        intent: "interpret_cautious",
      },
      {
        id: "an-code",
        label: "Detect Code Words or Patterns",
        hover: "Pattern-style review via the same structured analysis on extracted text.",
        status: "partial",
        href: "evidence-first",
        intent: "code_words",
      },
      {
        id: "an-corr",
        label: "Identify Corroboration",
        hover: "After analysis, review clusters and links; corroboration is framed cautiously in structured output.",
        status: "partial",
        caseAnalysisAction: "corroboration",
        caseAnalysisFallback: { href: "clusters" },
      },
      {
        id: "an-contra",
        label: "Identify Contradictions",
        hover: "Use structured analysis plus notes; automated contradiction matrix planned.",
        status: "partial",
        caseAnalysisAction: "contradictions",
        caseAnalysisFallback: { href: "evidence-first", intent: "contradictions" },
      },
    ],
  },
  {
    id: "build",
    sectionTitle: "Build Case Insight",
    sectionSubtitle: "Summaries, timelines, grouping, and working notes for your investigation.",
    actions: [
      {
        id: "bd-sum-ev",
        label: "Summarize Evidence",
        hover: "Per-file structured summaries via Run AI analysis; case-wide rollup planned.",
        status: "partial",
        caseAnalysisAction: "summarize_evidence",
        caseAnalysisFallback: { href: "evidence-first", intent: "summarize" },
      },
      {
        id: "bd-sum-sess",
        label: "Summarize Session",
        hover: "Session recap export — coming soon.",
        status: "planned",
      },
      {
        id: "bd-tl-build",
        label: "Build Timeline",
        hover: "View events extracted for this case (from analysis pipeline).",
        status: "available",
        href: "timeline",
      },
      {
        id: "bd-tl-refine",
        label: "Refine Timeline",
        hover: "Review and refine as new analysis adds events.",
        status: "partial",
        href: "timeline",
      },
      {
        id: "bd-group",
        label: "Group Related Evidence",
        hover: "Uses evidence_clusters from analysis (cross-type grouping when model + resolver populate clusters).",
        status: "partial",
        caseAnalysisAction: "group_related_evidence",
        caseAnalysisFallback: { href: "clusters" },
      },
      {
        id: "bd-notes",
        label: "Generate Case Notes",
        hover: "Add working notes in Case notes (human-authored; AI draft from case planned).",
        status: "available",
        href: "#case-notes",
      },
      {
        id: "bd-report",
        label: "Generate Summary Report",
        hover: "Exportable case report — coming soon; use notes for interim summaries.",
        status: "planned",
      },
    ],
  },
];
