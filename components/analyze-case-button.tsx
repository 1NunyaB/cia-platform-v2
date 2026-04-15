"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { dispatchWorkspaceAiAttachEvidence } from "@/lib/workspace-evidence-ai-bridge";

type CaseSnapshotPayload = {
  case_id: string;
  title: string;
  description: string;
  created_at: string;
  evidence_ids: string[];
  event_ids: string[];
  location_ids: string[];
  tags: string[];
  status: string;
};

export function AnalyzeCaseButton({ caseId }: { caseId: string }) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-8"
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          try {
            const res = await fetch(`/api/cases/${caseId}/snapshot`, {
              method: "GET",
              credentials: "include",
            });
            const data = (await res.json().catch(() => ({}))) as Partial<CaseSnapshotPayload> & { error?: string };
            if (!res.ok) {
              setError(data.error ?? "Could not build case snapshot.");
              return;
            }
            const prompt = [
              "You are analyzing structured investigation data.",
              "",
              "Evidence:",
              `${(data.evidence_ids ?? []).join(", ") || "none"}`,
              "",
              "Timeline context:",
              `${(data.event_ids ?? []).join(", ") || "none"}`,
              "",
              "Location context:",
              `${(data.location_ids ?? []).join(", ") || "none"}`,
              "",
              "User intent:",
              "Identify patterns, inconsistencies, or relationships",
              "",
              "Rules:",
              "- Do not assume facts not in evidence",
              "- Clearly label: Confirmed, Inferred, Uncertain",
              "",
              "Output:",
              "- Key findings",
              "- Timeline observations",
              "- Location correlations",
              "- Suggested next steps",
            ].join("\n");

            dispatchWorkspaceAiAttachEvidence({
              caseId,
              evidenceIds: data.evidence_ids ?? [],
              prompt,
              autoRun: true,
            });
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? (
          <>
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            Analyzing...
          </>
        ) : (
          "Analyze Case"
        )}
      </Button>
      {error ? <p className="text-[10px] text-rose-600">{error}</p> : null}
    </div>
  );
}

