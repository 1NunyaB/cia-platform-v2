/** Browser localStorage JSON array of workspace notes (scoped per auth user or guest session). */
export type WorkspaceNote = {
  id: string;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  /**
   * When set, the note is associated with one investigation (still personal / device-local only).
   * Omitted or unset for workspace-wide notes.
   */
  caseId?: string;
};

export function getWorkspaceNotesStorageKey(ownerKey: string): string {
  return `cia.workspace.notes.v1.${ownerKey}`;
}

/** Previous single-block workpad key — used only for one-time migration. */
export function getLegacyWorkpadStorageKey(ownerKey: string): string {
  return `cia.workpad.v1.${ownerKey}`;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parseNote(v: unknown): WorkspaceNote | null {
  if (!isRecord(v)) return null;
  const id = v.id;
  const title = v.title;
  const body = v.body;
  const createdAt = v.createdAt;
  const updatedAt = v.updatedAt;
  const rawCaseId = v.caseId;
  if (typeof id !== "string" || id.length === 0) return null;
  if (typeof title !== "string") return null;
  if (typeof body !== "string") return null;
  if (typeof createdAt !== "string" || typeof updatedAt !== "string") return null;
  if (rawCaseId !== undefined && rawCaseId !== null && typeof rawCaseId !== "string") {
    return null;
  }
  const note: WorkspaceNote = { id, title, body, createdAt, updatedAt };
  if (typeof rawCaseId === "string" && rawCaseId.length > 0) {
    note.caseId = rawCaseId;
  }
  return note;
}

export function parseNotesJson(raw: string | null): WorkspaceNote[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const out: WorkspaceNote[] = [];
    for (const item of data) {
      const n = parseNote(item);
      if (n) out.push(n);
    }
    return out;
  } catch {
    return [];
  }
}
