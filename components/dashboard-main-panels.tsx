"use client";

import { DashboardEvidencePreview, type DashboardEvidencePreviewRow } from "@/components/dashboard-evidence-preview";

export function DashboardMainPanels({
  evidenceRows,
}: {
  evidenceRows: DashboardEvidencePreviewRow[];
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-md border border-sky-300/80 bg-sky-50/80 px-3 py-2 text-xs text-foreground">
        Workplace chat is now in the right panel below Notes.
      </div>
      <DashboardEvidencePreview rows={evidenceRows} />
    </div>
  );
}

