"use client";

import Link from "next/link";
import * as React from "react";
import { usePathname } from "next/navigation";
import { Bold, Expand, List, Plus, StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { parseWorkspaceRouteContext } from "@/lib/workspace-route-context";
import {
  getWorkspaceCaseNotesStorageKey,
  loadWorkspaceCaseNotes,
  makeDefaultPage,
  makeDefaultSection,
  type CaseNotePage,
  type WorkspaceCaseNotesData,
} from "@/lib/workspace-case-notes-storage";
import { WORKSPACE_NOTE_CONTEXT_EVENT, type WorkspaceNoteContextDetail } from "@/lib/workspace-note-links-bridge";
import { cn } from "@/lib/utils";

type WorkspaceNotesPanelProps = {
  ownerKey: string;
  canDelete: boolean;
  density?: "default" | "compact";
};

const WORKSPACE_CASE_KEY = "__workspace__";

export function WorkspaceNotesPanel({ ownerKey, density = "default" }: WorkspaceNotesPanelProps) {
  const pathname = usePathname();
  const route = React.useMemo(() => parseWorkspaceRouteContext(pathname), [pathname]);
  const caseKey = route.caseId ?? WORKSPACE_CASE_KEY;
  const storageKey = getWorkspaceCaseNotesStorageKey(ownerKey);
  const compact = density === "compact";

  const [data, setData] = React.useState<WorkspaceCaseNotesData>({ notebooks: [] });
  const [activeSectionId, setActiveSectionId] = React.useState<string | null>(null);
  const [activePageId, setActivePageId] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState(false);
  const [context, setContext] = React.useState<WorkspaceNoteContextDetail>({
    caseId: null,
    selectedEvidenceIds: [],
    activeTimelineEventId: null,
    activeMarkerId: null,
    activeLocationLabel: null,
  });
  const saveTimerRef = React.useRef<number | undefined>(undefined);
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

  React.useEffect(() => {
    setData(loadWorkspaceCaseNotes(ownerKey));
  }, [ownerKey]);

  React.useEffect(() => {
    const onContext = (e: Event) => {
      const detail = (e as CustomEvent<WorkspaceNoteContextDetail>).detail;
      if (detail) setContext(detail);
    };
    window.addEventListener(WORKSPACE_NOTE_CONTEXT_EVENT, onContext);
    return () => window.removeEventListener(WORKSPACE_NOTE_CONTEXT_EVENT, onContext);
  }, []);

  const notebook = React.useMemo(
    () => data.notebooks.find((n) => n.caseId === caseKey) ?? { caseId: caseKey, sections: [makeDefaultSection()] },
    [caseKey, data.notebooks],
  );
  const sections = notebook.sections;
  const activeSection = sections.find((s) => s.id === activeSectionId) ?? sections[0] ?? null;
  const pages = activeSection?.pages ?? [];
  const activePage = pages.find((p) => p.id === activePageId) ?? pages[0] ?? null;

  const recentPages = React.useMemo(
    () =>
      sections
        .flatMap((s) => s.pages)
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .slice(0, 5),
    [sections],
  );

  React.useEffect(() => {
    if (!activeSection && sections[0]) setActiveSectionId(sections[0].id);
  }, [activeSection, sections]);
  React.useEffect(() => {
    if (!activePage && pages[0]) setActivePageId(pages[0].id);
  }, [activePage, pages]);

  const persistSoon = React.useCallback(
    (next: WorkspaceCaseNotesData) => {
      if (saveTimerRef.current !== undefined) window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      }, 250);
    },
    [storageKey],
  );

  const mutateData = React.useCallback(
    (updater: (prev: WorkspaceCaseNotesData) => WorkspaceCaseNotesData) => {
      setData((prev) => {
        const next = updater(prev);
        persistSoon(next);
        return next;
      });
    },
    [persistSoon],
  );

  React.useEffect(() => {
    mutateData((prev) => {
      if (prev.notebooks.some((n) => n.caseId === caseKey)) return prev;
      return { notebooks: [...prev.notebooks, { caseId: caseKey, sections: [makeDefaultSection()] }] };
    });
  }, [caseKey, mutateData]);

  const activatePage = React.useCallback(
    (pageId: string) => {
      for (const s of sections) {
        if (s.pages.some((p) => p.id === pageId)) {
          setActiveSectionId(s.id);
          setActivePageId(pageId);
          return;
        }
      }
    },
    [sections],
  );

  const patchPage = React.useCallback(
    (pageId: string, patch: Partial<CaseNotePage>) => {
      mutateData((prev) => ({
        notebooks: prev.notebooks.map((nb) =>
          nb.caseId !== caseKey
            ? nb
            : {
                ...nb,
                sections: nb.sections.map((s) => ({
                  ...s,
                  pages: s.pages.map((p) =>
                    p.id === pageId ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p,
                  ),
                })),
              },
        ),
      }));
    },
    [caseKey, mutateData],
  );

  const addSection = () => {
    const newSection = makeDefaultSection(`Section ${sections.length + 1}`);
    const firstPage = makeDefaultPage("Page 1");
    mutateData((prev) => ({
      notebooks: prev.notebooks.map((nb) =>
        nb.caseId === caseKey ? { ...nb, sections: [...nb.sections, { ...newSection, pages: [firstPage] }] } : nb,
      ),
    }));
    setActiveSectionId(newSection.id);
    setActivePageId(firstPage.id);
  };

  const addPage = () => {
    if (!activeSection) return;
    const newPage = makeDefaultPage(`Page ${pages.length + 1}`);
    mutateData((prev) => ({
      notebooks: prev.notebooks.map((nb) =>
        nb.caseId === caseKey
          ? {
              ...nb,
              sections: nb.sections.map((s) => (s.id === activeSection.id ? { ...s, pages: [newPage, ...s.pages] } : s)),
            }
          : nb,
      ),
    }));
    setActivePageId(newPage.id);
  };

  const applyMarkdownWrap = (before: string, after = before) => {
    if (!activePage || !textareaRef.current) return;
    const el = textareaRef.current;
    const start = el.selectionStart ?? activePage.body.length;
    const end = el.selectionEnd ?? activePage.body.length;
    const selected = activePage.body.slice(start, end);
    const nextBody = `${activePage.body.slice(0, start)}${before}${selected}${after}${activePage.body.slice(end)}`;
    patchPage(activePage.id, { body: nextBody });
  };

  const linkFromContext = (kind: "evidence" | "timeline" | "location") => {
    if (!activePage) return;
    if (kind === "evidence" && context.selectedEvidenceIds.length > 0) {
      patchPage(activePage.id, {
        links: {
          ...activePage.links,
          evidenceIds: [...new Set([...activePage.links.evidenceIds, ...context.selectedEvidenceIds])],
        },
      });
      return;
    }
    if (kind === "timeline" && context.activeTimelineEventId) {
      patchPage(activePage.id, {
        links: {
          ...activePage.links,
          timelineEventIds: [...new Set([...activePage.links.timelineEventIds, context.activeTimelineEventId])],
        },
      });
      return;
    }
    if (kind === "location" && context.activeMarkerId) {
      patchPage(activePage.id, {
        links: {
          ...activePage.links,
          locationIds: [...new Set([...activePage.links.locationIds, context.activeMarkerId])],
        },
      });
    }
  };

  const editor = (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="flex shrink-0 items-center gap-1">
        <Button type="button" size="sm" variant="outline" className={cn("px-2 text-[10px]", compact && "h-5 text-[9px]")} onClick={() => applyMarkdownWrap("**")}>
          <Bold className="mr-1 h-3 w-3" /> Bold
        </Button>
        <Button type="button" size="sm" variant="outline" className={cn("px-2 text-[10px]", compact && "h-5 text-[9px]")} onClick={() => applyMarkdownWrap("\n- ", "")}>
          <List className="mr-1 h-3 w-3" /> List
        </Button>
      </div>
      <Input
        value={activePage?.title ?? ""}
        onChange={(e) => activePage && patchPage(activePage.id, { title: e.target.value })}
        placeholder="Note title"
        className={cn(compact ? "h-7 text-xs" : "h-8")}
      />
      <Textarea
        ref={textareaRef}
        value={activePage?.body ?? ""}
        onChange={(e) => activePage && patchPage(activePage.id, { body: e.target.value })}
        placeholder="Write your investigation note..."
        className={cn(
          "min-h-0 resize-y leading-relaxed text-sm",
          compact ? "min-h-[100px] max-h-[150px]" : "min-h-[360px]",
        )}
      />
      <div className="shrink-0 rounded border border-border/70 bg-muted/20 p-1.5 text-[10px] text-muted-foreground">
        <div className="mb-1 flex flex-wrap gap-1">
          <Button type="button" size="sm" variant="outline" className={cn("px-2 text-[10px]", compact && "h-5 text-[9px]")} onClick={() => linkFromContext("evidence")}>
            Link evidence
          </Button>
          <Button type="button" size="sm" variant="outline" className={cn("px-2 text-[10px]", compact && "h-5 text-[9px]")} onClick={() => linkFromContext("timeline")}>
            Link timeline
          </Button>
          <Button type="button" size="sm" variant="outline" className={cn("px-2 text-[10px]", compact && "h-5 text-[9px]")} onClick={() => linkFromContext("location")}>
            Link map
          </Button>
        </div>
        <div className="flex flex-wrap gap-1">
          {(activePage?.links.evidenceIds ?? []).map((id) => (
            <Link
              key={id}
              href={route.caseId ? `/cases/${route.caseId}/evidence/${id}` : `/evidence/${id}`}
              className="rounded bg-sky-900/40 px-1.5 py-0.5 text-[10px] text-sky-100 underline underline-offset-2"
            >
              Evidence {id.slice(0, 8)}...
            </Link>
          ))}
          {(activePage?.links.timelineEventIds ?? []).map((id) => (
            <button
              key={id}
              type="button"
              className="rounded bg-amber-900/40 px-1.5 py-0.5 text-[10px] text-amber-100 underline underline-offset-2"
              onClick={() => window.dispatchEvent(new CustomEvent("cia:focus-timeline-event", { detail: { eventId: id } }))}
            >
              Timeline {id.slice(0, 8)}...
            </button>
          ))}
          {(activePage?.links.locationIds ?? []).map((id) => (
            <button
              key={id}
              type="button"
              className="rounded bg-emerald-900/40 px-1.5 py-0.5 text-[10px] text-emerald-100 underline underline-offset-2"
              onClick={() => window.dispatchEvent(new CustomEvent("cia:focus-map-marker", { detail: { markerId: id } }))}
            >
              {context.activeMarkerId === id && context.activeLocationLabel ? context.activeLocationLabel : `Location ${id.slice(0, 8)}...`}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-1.5", compact && "shrink-0 text-xs")}>
      <div className="flex shrink-0 items-center justify-between gap-1">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Notes</p>
        <Button type="button" size="sm" variant="outline" className="h-6 gap-1 px-2 text-[10px]" onClick={() => setExpanded(true)}>
          <Expand className="h-3 w-3" /> Expand
        </Button>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-1">
        <Button type="button" size="sm" variant="outline" className="h-5 px-1.5 text-[9px]" onClick={addSection}>
          <Plus className="mr-0.5 h-3 w-3" /> Sec
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-5 px-1.5 text-[9px]" onClick={addPage}>
          <StickyNote className="mr-0.5 h-3 w-3" /> Page
        </Button>
        {sections.slice(0, 4).map((s) => (
          <button
            key={s.id}
            type="button"
            className={cn(
              "max-w-[5.5rem] truncate rounded border px-1.5 py-0.5 text-[9px]",
              activeSection?.id === s.id ? "border-sky-500 bg-sky-500/10 text-sky-100" : "border-border text-muted-foreground",
            )}
            title={s.title}
            onClick={() => setActiveSectionId(s.id)}
          >
            {s.title}
          </button>
        ))}
      </div>
      {recentPages.length > 0 ? (
        <div className="flex shrink-0 flex-wrap gap-1">
          {recentPages.slice(0, 4).map((p) => (
            <button
              key={p.id}
              type="button"
              className="max-w-[6rem] truncate rounded border border-border/70 bg-muted/20 px-1.5 py-0.5 text-[9px] text-muted-foreground"
              title={p.title || "Untitled"}
              onClick={() => activatePage(p.id)}
            >
              {p.title || "Untitled"}
            </button>
          ))}
        </div>
      ) : null}
      {editor}

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent className="max-h-[92vh] max-w-[min(96vw,1300px)] overflow-hidden border-slate-500/70 bg-slate-950 p-0 text-slate-100">
          <DialogHeader className="border-b border-slate-700 px-4 py-3">
            <DialogTitle className="text-sm">Case Notes Workspace</DialogTitle>
          </DialogHeader>
          <div className="grid h-[84vh] grid-cols-12">
            <aside className="col-span-3 border-r border-slate-700 p-3">
              <div className="mb-2 flex items-center gap-2">
                <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={addSection}>
                  + Section
                </Button>
                <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={addPage}>
                  + Page
                </Button>
              </div>
              <div className="space-y-2 overflow-y-auto pr-1">
                {sections.map((s) => (
                  <div key={s.id} className="rounded border border-slate-700 p-2">
                    <Input
                      value={s.title}
                      onChange={(e) =>
                        mutateData((prev) => ({
                          notebooks: prev.notebooks.map((nb) =>
                            nb.caseId === caseKey
                              ? {
                                  ...nb,
                                  sections: nb.sections.map((sec) =>
                                    sec.id === s.id ? { ...sec, title: e.target.value } : sec,
                                  ),
                                }
                              : nb,
                          ),
                        }))
                      }
                      className="h-7 bg-slate-900 text-xs"
                    />
                    <div className="mt-2 space-y-1">
                      {s.pages.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => activatePage(p.id)}
                          className={cn(
                            "block w-full truncate rounded border px-2 py-1 text-left text-xs",
                            activePage?.id === p.id
                              ? "border-sky-500 bg-sky-500/10 text-sky-100"
                              : "border-slate-700 text-slate-300",
                          )}
                        >
                          {p.title || "Untitled"}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </aside>
            <div className="col-span-9 p-3">{editor}</div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
