"use client";

import { Button } from "@/components/ui/button";
import { dispatchWorkspaceAiAttachEvidence } from "@/lib/workspace-evidence-ai-bridge";
import { dispatchWorkspaceNoteContext } from "@/lib/workspace-note-links-bridge";

export function SelectCaseContextButton({ caseId }: { caseId: string }) {
  return (
    <Button
      type="button"
      size="sm"
      variant="secondary"
      className="h-8"
      onClick={() => {
        dispatchWorkspaceAiAttachEvidence({ caseId });
        dispatchWorkspaceNoteContext({
          caseId,
          selectedEvidenceIds: [],
          activeTimelineEventId: null,
          activeMarkerId: null,
          activeLocationLabel: null,
        });
      }}
    >
      Select Case
    </Button>
  );
}

