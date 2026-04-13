"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Link2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getLegacyWorkpadStorageKey,
  getWorkspaceNotesStorageKey,
  parseNotesJson,
  type WorkspaceNote,
} from "@/lib/workspace-notes-storage";
import { parseWorkspaceRouteContext } from "@/lib/workspace-route-context";
import { cn } from "@/lib/utils";
import {
  EXTRACTION_REMINDER_EVENT,
  type ExtractionReminderDetail,
} from "@/lib/extraction-reminder-event";

type WorkspaceNotesPanelProps = {
  ownerKey: string;
  canDelete: boolean;
};

function formatNoteTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

function loadNotesWithMigration(storageKey: string, ownerKey: string): WorkspaceNote[] {
  try {
    const raw = window.localStorage.getItem(storageKey);
    let notes = parseNotesJson(raw);
    if (notes.length === 0) {
      const legacy = window.localStorage.getItem(getLegacyWorkpadStorageKey(ownerKey));
      if (legacy && legacy.trim()) {
        const t = new Date().toISOString();
        notes = [
          {
            id: crypto.randomUUID(),
            title: "",
            body: legacy,
            createdAt: t,
            updatedAt: t,
          },
        ];
        window.localStorage.setItem(storageKey, JSON.stringify(notes));
      }
    }
    return notes;
  } catch {
    return [];
  }
}

function evidenceLinkMarkdown(path: string): string {
  return `\n[Evidence](${path})\n`;
}

export function WorkspaceNotesPanel({ ownerKey, canDelete }: WorkspaceNotesPanelProps) {
  const pathname = usePathname();
  const route = React.useMemo(() => parseWorkspaceRouteContext(pathname), [pathname]);

  const storageKey = getWorkspaceNotesStorageKey(ownerKey);
  const [notes, setNotes] = React.useState<WorkspaceNote[]>([]);
  const saveTimerRef = React.useRef<number | undefined>(undefined);
  const notesRef = React.useRef<WorkspaceNote[]>([]);
  notesRef.current = notes;

  /** When viewing a case, choose workspace-wide vs investigation-scoped notes. */
  const [noteScope, setNoteScope] = React.useState<"workspace" | "case">("workspace");
  const [activeNoteId, setActiveNoteId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (route.caseId) {
      setNoteScope("case");
    } else {
      setNoteScope("workspace");
    }
  }, [route.caseId]);

  React.useEffect(() => {
    setNotes(loadNotesWithMigration(storageKey, ownerKey));
  }, [storageKey, ownerKey]);

  const visibleNotes = React.useMemo(() => {
    if (route.caseId && noteScope === "case") {
      return notes.filter((n) => n.caseId === route.caseId);
    }
    return notes.filter((n) => !n.caseId);
  }, [notes, route.caseId, noteScope]);

  React.useEffect(() => {
    if (visibleNotes.length === 0) {
      setActiveNoteId(null);
      return;
    }
    setActiveNoteId((prev) =>
      prev && visibleNotes.some((n) => n.id === prev) ? prev : visibleNotes[0].id,
    );
  }, [visibleNotes]);

  const persistSoon = React.useCallback(
    (list: WorkspaceNote[]) => {
      if (saveTimerRef.current !== undefined) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        try {
          window.localStorage.setItem(storageKey, JSON.stringify(list));
        } catch {
          /* ignore */
        }
      }, 400);
    },
    [storageKey],
  );

  React.useEffect(() => {
    const onReminder = (e: Event) => {
      const ce = e as CustomEvent<ExtractionReminderDetail>;
      const d = ce.detail;
      if (!d?.evidenceId || !d.href) return;
      const marker = `[reminder:extraction:${d.evidenceId}]`;
      if (notesRef.current.some((n) => n.body.includes(marker))) return;
      const t = new Date().toISOString();
      const noteCaseId = d.caseId?.trim() ? d.caseId : undefined;
      const body = `${marker}\n\nUpload succeeded, but text extraction did not finish.\nFile: ${d.filename}\nOpen: [Evidence](${d.href})\nUse **Run extraction** on that page when you are ready.\n`;
      const note: WorkspaceNote = {
        id: crypto.randomUUID(),
        title: `Extraction — ${d.filename}`,
        body,
        createdAt: t,
        updatedAt: t,
        ...(noteCaseId ? { caseId: noteCaseId } : {}),
      };
      setNotes((prev) => {
        const next = [note, ...prev];
        persistSoon(next);
        return next;
      });
      setActiveNoteId(note.id);
    };
    window.addEventListener(EXTRACTION_REMINDER_EVENT, onReminder);
    return () => window.removeEventListener(EXTRACTION_REMINDER_EVENT, onReminder);
  }, [persistSoon]);

  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current !== undefined) {
        window.clearTimeout(saveTimerRef.current);
      }
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(notesRef.current));
      } catch {
        /* ignore */
      }
    };
  }, [storageKey]);

  const caseIdForNewNote = route.caseId && noteScope === "case" ? route.caseId : undefined;

  const patchNote = React.useCallback(
    (id: string, patch: Partial<Pick<WorkspaceNote, "title" | "body">>) => {
      setNotes((prev) => {
        const next = prev.map((n) => {
          if (n.id !== id) return n;
          const updatedAt = new Date().toISOString();
          return { ...n, ...patch, updatedAt };
        });
        persistSoon(next);
        return next;
      });
    },
    [persistSoon],
  );

  const addNote = React.useCallback(() => {
    const t = new Date().toISOString();
    const note: WorkspaceNote = {
      id: crypto.randomUUID(),
      title: "",
      body: "",
      createdAt: t,
      updatedAt: t,
      ...(caseIdForNewNote ? { caseId: caseIdForNewNote } : {}),
    };
    setNotes((prev) => {
      const next = [note, ...prev];
      persistSoon(next);
      return next;
    });
    setActiveNoteId(note.id);
  }, [caseIdForNewNote, persistSoon]);

  const insertEvidenceReference = React.useCallback(() => {
    if (!route.evidenceLinkPath) return;
    const line = evidenceLinkMarkdown(route.evidenceLinkPath);
    const cid = route.caseId && noteScope === "case" ? route.caseId : undefined;

    if (visibleNotes.length === 0) {
      const t = new Date().toISOString();
      const newNote: WorkspaceNote = {
        id: crypto.randomUUID(),
        title: "",
        body: line.trim(),
        createdAt: t,
        updatedAt: t,
        ...(cid ? { caseId: cid } : {}),
      };
      setNotes((prev) => {
        const next = [newNote, ...prev];
        persistSoon(next);
        return next;
      });
      setActiveNoteId(newNote.id);
      return;
    }

    const targetId = activeNoteId ?? visibleNotes[0].id;
    setNotes((prev) => {
      const next = prev.map((n) => {
        if (n.id !== targetId) return n;
        return {
          ...n,
          body: n.body + line,
          updatedAt: new Date().toISOString(),
        };
      });
      persistSoon(next);
      return next;
    });
  }, [
    activeNoteId,
    noteScope,
    persistSoon,
    route.caseId,
    route.evidenceLinkPath,
    visibleNotes,
  ]);

  const removeNote = React.useCallback(
    (id: string) => {
      setNotes((prev) => {
        const next = prev.filter((n) => n.id !== id);
        persistSoon(next);
        return next;
      });
    },
    [persistSoon],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {route.caseId && (
        <div
          className="flex shrink-0 rounded-md border border-border bg-muted/30 p-0.5 text-[11px]"
          role="group"
          aria-label="Note scope"
        >
          <button
            type="button"
            className={cn(
              "flex-1 rounded px-2 py-1.5 font-medium transition-colors",
              noteScope === "workspace"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setNoteScope("workspace")}
          >
            Workspace
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 rounded px-2 py-1.5 font-medium transition-colors",
              noteScope === "case"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            onClick={() => setNoteScope("case")}
          >
            This investigation
          </button>
        </div>
      )}

      {route.evidenceLinkPath && (
        <div className="shrink-0 rounded-lg border border-dashed border-border bg-muted/20 px-2.5 py-2">
          <p className="mb-1.5 text-[10px] leading-snug text-muted-foreground">
            Open evidence — insert a markdown link into the focused note (or create one).
          </p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 w-full gap-1.5 text-xs"
            onClick={insertEvidenceReference}
          >
            <Link2 className="size-3.5" aria-hidden />
            Insert evidence link
          </Button>
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full shrink-0 justify-center gap-1.5"
        onClick={addNote}
      >
        <Plus className="size-3.5" aria-hidden />
        Add note
      </Button>

      {visibleNotes.length === 0 ? (
        <EmptyState title="No notes in this scope" className="py-6">
          <p className="text-xs">Add a note above, or switch scope if you are on an investigation.</p>
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3 pb-1">
          {visibleNotes.map((note) => (
            <li key={note.id}>
              <NoteCard
                note={note}
                isActive={activeNoteId === note.id}
                onActivate={() => setActiveNoteId(note.id)}
                onChangeTitle={(v) => patchNote(note.id, { title: v })}
                onChangeBody={(v) => patchNote(note.id, { body: v })}
                onRemove={() => removeNote(note.id)}
                canDelete={canDelete}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-auto shrink-0 text-[10px] leading-snug text-muted-foreground">
        Personal notes on this device only — not shared with collaborators by default.
      </p>
    </div>
  );
}

type NoteCardProps = {
  note: WorkspaceNote;
  isActive: boolean;
  onActivate: () => void;
  onChangeTitle: (value: string) => void;
  onChangeBody: (value: string) => void;
  onRemove: () => void;
  canDelete: boolean;
};

function NoteCard({
  note,
  isActive,
  onActivate,
  onChangeTitle,
  onChangeBody,
  onRemove,
  canDelete,
}: NoteCardProps) {
  const created = formatNoteTimestamp(note.createdAt);
  const updated = formatNoteTimestamp(note.updatedAt);
  const showBoth = note.createdAt !== note.updatedAt;

  return (
    <Card
      className={cn(
        "overflow-hidden border-border bg-background shadow-sm transition-shadow",
        "ring-1 ring-border/60",
        isActive && "ring-2 ring-ring/40",
      )}
    >
      <div className="space-y-2 p-3">
        <div className="flex items-start gap-1.5">
          <Input
            value={note.title}
            onChange={(e) => onChangeTitle(e.target.value)}
            onFocus={onActivate}
            placeholder="Title (optional)"
            className="h-8 flex-1 text-sm font-medium"
            aria-label="Note title"
          />
          {canDelete ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
              onClick={onRemove}
              aria-label="Delete note"
            >
              <Trash2 className="size-3.5" aria-hidden />
            </Button>
          ) : null}
        </div>

        <Textarea
          value={note.body}
          onChange={(e) => onChangeBody(e.target.value)}
          onFocus={onActivate}
          placeholder="Write here…"
          className="min-h-[88px] resize-y text-sm"
          aria-label="Note body"
          spellCheck
        />

        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 border-t border-border/80 pt-2 text-[10px] text-muted-foreground">
          <span title={updated}>Updated {updated}</span>
          {showBoth && (
            <>
              <span className="text-border" aria-hidden>
                ·
              </span>
              <span title={created}>Created {created}</span>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
