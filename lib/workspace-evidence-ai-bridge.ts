/**
 * Client-side bridge: attach evidence to the workspace AI panel from lists, drag/drop, etc.
 */

export const WORKSPACE_AI_ATTACH_EVENT = "cia:workspaceAiAttachEvidence";

export type WorkspaceAiAttachDetail = {
  /** Case id for workspace context (may differ from URL when multi-case). */
  caseId: string | null;
  /** Attach a single file (replaces the AI panel selection). */
  evidenceId?: string;
  /** Attach many files at once (replaces the AI panel selection). */
  evidenceIds?: string[];
  /** Label for a single-file attach; multi-file labels load from the API. */
  label?: string;
  /** Optional prompt text to prefill in the AI panel. */
  prompt?: string;
  /** If true with prompt + evidence, submit immediately after attach. */
  autoRun?: boolean;
};

export function dispatchWorkspaceAiAttachEvidence(detail: WorkspaceAiAttachDetail): void {
  if (typeof window === "undefined") return;
  const hasSingle = Boolean(detail.evidenceId?.trim());
  const hasMany = Array.isArray(detail.evidenceIds) && detail.evidenceIds.length > 0;
  if (!hasSingle && !hasMany && !detail.caseId) return;
  window.dispatchEvent(new CustomEvent(WORKSPACE_AI_ATTACH_EVENT, { detail }));
}

/** MIME type for drag payloads from evidence rows. */
export const WORKSPACE_AI_DRAG_MIME = "application/x-cia-evidence-id";

export function readEvidenceIdFromDataTransfer(dt: DataTransfer | null): string | null {
  if (!dt) return null;
  try {
    const raw = dt.getData(WORKSPACE_AI_DRAG_MIME);
    if (raw?.trim()) return raw.trim();
  } catch {
    /* ignore */
  }
  return null;
}
