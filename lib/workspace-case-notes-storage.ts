import { getLegacyWorkpadStorageKey, getWorkspaceNotesStorageKey, parseNotesJson } from "@/lib/workspace-notes-storage";

export type NoteLinkRefs = {
  evidenceIds: string[];
  timelineEventIds: string[];
  locationIds: string[];
};

export type CaseNotePage = {
  id: string;
  title: string;
  body: string;
  links: NoteLinkRefs;
  createdAt: string;
  updatedAt: string;
};

export type CaseNoteSection = {
  id: string;
  title: string;
  pages: CaseNotePage[];
};

export type CaseNotebook = {
  caseId: string;
  sections: CaseNoteSection[];
};

export type WorkspaceCaseNotesData = {
  notebooks: CaseNotebook[];
};

export function getWorkspaceCaseNotesStorageKey(ownerKey: string): string {
  return `cia.workspace.case-notes.v1.${ownerKey}`;
}

export function makeDefaultSection(title = "Leads"): CaseNoteSection {
  return { id: crypto.randomUUID(), title, pages: [] };
}

export function makeDefaultPage(title = "Untitled page"): CaseNotePage {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    body: "",
    links: { evidenceIds: [], timelineEventIds: [], locationIds: [] },
    createdAt: now,
    updatedAt: now,
  };
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function parsePage(v: unknown): CaseNotePage | null {
  if (!isRecord(v)) return null;
  if (typeof v.id !== "string" || typeof v.title !== "string" || typeof v.body !== "string") return null;
  if (typeof v.createdAt !== "string" || typeof v.updatedAt !== "string") return null;
  const links = isRecord(v.links) ? v.links : {};
  const parseList = (value: unknown) => (Array.isArray(value) ? value.filter((x): x is string => typeof x === "string") : []);
  return {
    id: v.id,
    title: v.title,
    body: v.body,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    links: {
      evidenceIds: parseList(links.evidenceIds),
      timelineEventIds: parseList(links.timelineEventIds),
      locationIds: parseList(links.locationIds),
    },
  };
}

function parseSection(v: unknown): CaseNoteSection | null {
  if (!isRecord(v)) return null;
  if (typeof v.id !== "string" || typeof v.title !== "string" || !Array.isArray(v.pages)) return null;
  return { id: v.id, title: v.title, pages: v.pages.map(parsePage).filter(Boolean) as CaseNotePage[] };
}

function parseNotebook(v: unknown): CaseNotebook | null {
  if (!isRecord(v)) return null;
  if (typeof v.caseId !== "string" || !Array.isArray(v.sections)) return null;
  return { caseId: v.caseId, sections: v.sections.map(parseSection).filter(Boolean) as CaseNoteSection[] };
}

export function parseWorkspaceCaseNotesJson(raw: string | null): WorkspaceCaseNotesData {
  if (!raw) return { notebooks: [] };
  try {
    const data = JSON.parse(raw) as unknown;
    if (!isRecord(data) || !Array.isArray(data.notebooks)) return { notebooks: [] };
    return { notebooks: data.notebooks.map(parseNotebook).filter(Boolean) as CaseNotebook[] };
  } catch {
    return { notebooks: [] };
  }
}

export function loadWorkspaceCaseNotes(ownerKey: string): WorkspaceCaseNotesData {
  try {
    const key = getWorkspaceCaseNotesStorageKey(ownerKey);
    const parsed = parseWorkspaceCaseNotesJson(window.localStorage.getItem(key));
    if (parsed.notebooks.length > 0) return parsed;

    const legacyNotes = parseNotesJson(window.localStorage.getItem(getWorkspaceNotesStorageKey(ownerKey)));
    if (legacyNotes.length > 0) {
      const byCase = new Map<string, CaseNotePage[]>();
      for (const note of legacyNotes) {
        const caseId = note.caseId ?? "__workspace__";
        const list = byCase.get(caseId) ?? [];
        list.push({
          id: note.id,
          title: note.title || "Migrated note",
          body: note.body,
          createdAt: note.createdAt,
          updatedAt: note.updatedAt,
          links: { evidenceIds: [], timelineEventIds: [], locationIds: [] },
        });
        byCase.set(caseId, list);
      }
      const migrated: WorkspaceCaseNotesData = {
        notebooks: [...byCase.entries()].map(([caseId, pages]) => ({
          caseId,
          sections: [{ id: crypto.randomUUID(), title: "Imported", pages }],
        })),
      };
      window.localStorage.setItem(key, JSON.stringify(migrated));
      return migrated;
    }

    const legacyWorkpad = window.localStorage.getItem(getLegacyWorkpadStorageKey(ownerKey));
    if (legacyWorkpad && legacyWorkpad.trim()) {
      const data: WorkspaceCaseNotesData = {
        notebooks: [
          {
            caseId: "__workspace__",
            sections: [
              {
                id: crypto.randomUUID(),
                title: "Imported",
                pages: [{ ...makeDefaultPage("Imported note"), body: legacyWorkpad.trim() }],
              },
            ],
          },
        ],
      };
      window.localStorage.setItem(key, JSON.stringify(data));
      return data;
    }
  } catch {
    return { notebooks: [] };
  }
  return { notebooks: [] };
}

