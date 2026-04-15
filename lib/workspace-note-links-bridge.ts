export const WORKSPACE_NOTE_CONTEXT_EVENT = "cia:workspace-note-context";

export type WorkspaceNoteContextDetail = {
  caseId: string | null;
  selectedEvidenceIds: string[];
  activeTimelineEventId: string | null;
  activeMarkerId: string | null;
  activeLocationLabel: string | null;
};

export function dispatchWorkspaceNoteContext(detail: WorkspaceNoteContextDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<WorkspaceNoteContextDetail>(WORKSPACE_NOTE_CONTEXT_EVENT, { detail }));
}

