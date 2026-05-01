/**
 * Dark CIS workspace chrome for the case detail route — palette aligned with
 * `components/cases-page-client.tsx` (#0f1623 canvas, #141e2e panels, #1e2d42 borders).
 */
export const cisCasePage = {
  canvas: "min-h-full w-full bg-[#0f1623] text-slate-200",
  /** Optional narrow column — case detail page uses full workspace width (original layout). */
  inner: "mx-auto w-full max-w-6xl space-y-8 px-4 pb-12 sm:px-5",
  pageTitle: "text-2xl font-bold tracking-tight text-white sm:text-3xl",
  /** Matches original case title weight (`font-semibold`). */
  pageTitleLayout: "text-2xl font-semibold tracking-tight text-white",
  breadcrumbLink: "text-sm font-medium text-slate-400 transition-colors hover:text-slate-200",
  introLegal: "mt-3 max-w-3xl text-xs leading-relaxed text-slate-500",
  panel: "rounded-xl border border-[#1e2d42] bg-[#141e2e] text-slate-200 shadow-none",
  panelHeaderBorder: "border-b border-[#1e2d42]",
  cardTitle: "text-lg font-semibold tracking-tight text-white",
  cardTitleSm: "text-base font-semibold tracking-tight text-white",
  cardDescription: "text-sm text-slate-400",
  outlineBtn:
    "border border-[#334155] bg-[#1a2335] text-slate-100 shadow-none hover:bg-[#243045] hover:text-white",
  secondaryBtn:
    "border border-[#334155] bg-[#1a2335] text-slate-200 shadow-none hover:bg-[#243045] hover:text-white",
  noteListItem: "rounded-lg border border-[#1e2d42] bg-[#111827]/90 p-3 text-sm text-slate-200",
  noteVisibilityBadge: "rounded border border-slate-600/70 bg-slate-900/50 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400",
  indexPillBase: "text-left rounded-md border px-2 py-1.5 text-xs transition-colors",
  indexPillInactive: "border-[#1e2d42] bg-[#0f1623] text-slate-300 hover:border-slate-600 hover:bg-[#1a2335]",
  indexPillActive: "border-sky-500/45 bg-[#1e3a5f] text-sky-200 font-medium",
  indexSectionTitle: "text-[11px] font-semibold uppercase tracking-wide text-slate-500",
  linkAccent: "font-medium text-sky-400 underline-offset-2 hover:text-sky-300 hover:underline",
  evidenceRow: "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#1e2d42] bg-[#111827]/80 p-2.5",
  bulkSelectRow:
    "flex flex-wrap items-center gap-2 rounded-md border border-dashed border-[#334155] bg-[#0f1623]/80 px-2.5 py-2 text-xs text-slate-300",
  sendToAiBtn:
    "h-7 border border-sky-500/40 bg-sky-950/40 px-2 text-[10px] font-semibold text-sky-200 hover:bg-sky-950/70",
} as const;

export const cisCaseForm = {
  control:
    "w-full rounded-lg border border-[#1e2d42] bg-[#0f1623] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/35",
  label: "text-xs font-medium text-slate-300",
} as const;
