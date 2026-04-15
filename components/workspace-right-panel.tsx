"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceEvidenceAiPanel } from "@/components/workspace-evidence-ai-panel";
import { WorkspaceNotesPanel } from "@/components/workspace-notes-panel";
import { cn } from "@/lib/utils";

const STORAGE_COLLAPSED = "cia.workspace.rightPanel.collapsed";
const STORAGE_WIDTH = "cia.workspace.rightPanel.widthPx";
const STORAGE_NOTES_HEIGHT = "cia.workspace.rightPanel.notesHeightPx";
const STORAGE_AI_HEIGHT = "cia.workspace.rightPanel.aiHeightPx";

/** Narrower default so the command center column stays primary. */
const DEFAULT_PANEL_WIDTH = 276;
const COLLAPSED_WIDTH_PX = 52;
const MIN_PANEL = 248;
const MAX_PANEL = 360;
/** Do not let the panel exceed this fraction of the viewport width. */
const MAX_VIEWPORT_FRACTION = 0.34;
const DEFAULT_NOTES_HEIGHT = 140;
const MIN_NOTES_HEIGHT = 100;
const MAX_NOTES_HEIGHT = 260;
const MIN_CHAT_HEIGHT = 180;
const DEFAULT_AI_HEIGHT = 260;
const MIN_AI_HEIGHT = 140;
const MAX_AI_HEIGHT = 520;
const MIN_NOTES_CHAT_HEIGHT = 220;

function clampPanelWidth(px: number, viewportWidth: number): number {
  const maxByViewport = Math.min(MAX_PANEL, Math.floor(viewportWidth * MAX_VIEWPORT_FRACTION));
  const minAllowed = MIN_PANEL;
  if (maxByViewport < minAllowed) {
    return Math.min(minAllowed, Math.max(200, maxByViewport));
  }
  return Math.max(minAllowed, Math.min(maxByViewport, Math.round(px)));
}

function clampNotesHeight(px: number, availableHeight: number): number {
  const maxByAvailable = Math.max(MIN_NOTES_HEIGHT, availableHeight - MIN_CHAT_HEIGHT);
  const maxAllowed = Math.min(MAX_NOTES_HEIGHT, maxByAvailable);
  return Math.max(MIN_NOTES_HEIGHT, Math.min(maxAllowed, Math.round(px)));
}

function clampAiHeight(px: number, availableHeight: number): number {
  const maxByAvailable = Math.max(MIN_AI_HEIGHT, availableHeight - MIN_NOTES_CHAT_HEIGHT);
  const maxAllowed = Math.min(MAX_AI_HEIGHT, maxByAvailable);
  return Math.max(MIN_AI_HEIGHT, Math.min(maxAllowed, Math.round(px)));
}

type WorkspaceShellWithPanelProps = {
  notesOwnerKey: string;
  canDelete: boolean;
  children: React.ReactNode;
  /** Signed-in workspace chat — rendered below Notes when set. */
  chatSlot?: React.ReactNode;
};

/**
 * Main workspace column + draggable resize handle + notes panel (right).
 * Controls panel width (React state + localStorage) and collapse (thin bar).
 */
export function WorkspaceShellWithPanel({
  notesOwnerKey,
  canDelete,
  children,
  chatSlot = null,
}: WorkspaceShellWithPanelProps) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [chatCollapsed, setChatCollapsed] = React.useState(false);
  const [panelWidthPx, setPanelWidthPx] = React.useState(DEFAULT_PANEL_WIDTH);
  const [dragging, setDragging] = React.useState(false);
  const [notesHeightPx, setNotesHeightPx] = React.useState(DEFAULT_NOTES_HEIGHT);
  const [notesDragging, setNotesDragging] = React.useState(false);
  const [aiHeightPx, setAiHeightPx] = React.useState(DEFAULT_AI_HEIGHT);
  const dragStartXRef = React.useRef(0);
  const dragStartWidthRef = React.useRef(DEFAULT_PANEL_WIDTH);
  const notesStartYRef = React.useRef(0);
  const notesStartHeightRef = React.useRef(DEFAULT_NOTES_HEIGHT);
  const aiDraggingRef = React.useRef(false);
  const aiStartYRef = React.useRef(0);
  const aiStartHeightRef = React.useRef(DEFAULT_AI_HEIGHT);
  const rightBodyRef = React.useRef<HTMLDivElement | null>(null);
  const notesAreaRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    try {
      const c = localStorage.getItem(STORAGE_COLLAPSED);
      if (c === "1") setCollapsed(true);
      const w = localStorage.getItem(STORAGE_WIDTH);
      if (w != null) {
        const parsed = Number.parseInt(w, 10);
        if (!Number.isNaN(parsed)) {
          setPanelWidthPx(clampPanelWidth(parsed, window.innerWidth));
        }
      }
      const nh = localStorage.getItem(STORAGE_NOTES_HEIGHT);
      if (nh != null) {
        const parsed = Number.parseInt(nh, 10);
        if (!Number.isNaN(parsed)) {
          const available = notesAreaRef.current?.clientHeight ?? 520;
          setNotesHeightPx(clampNotesHeight(parsed, available));
        }
      }
      const ah = localStorage.getItem(STORAGE_AI_HEIGHT);
      if (ah != null) {
        const parsed = Number.parseInt(ah, 10);
        if (!Number.isNaN(parsed)) {
          const available = rightBodyRef.current?.clientHeight ?? 640;
          setAiHeightPx(clampAiHeight(parsed, available));
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  const persistWidth = React.useCallback((w: number) => {
    try {
      localStorage.setItem(STORAGE_WIDTH, String(w));
    } catch {
      /* ignore */
    }
  }, []);

  const persistNotesHeight = React.useCallback((h: number) => {
    try {
      localStorage.setItem(STORAGE_NOTES_HEIGHT, String(h));
    } catch {
      /* ignore */
    }
  }, []);

  const persistAiHeight = React.useCallback((h: number) => {
    try {
      localStorage.setItem(STORAGE_AI_HEIGHT, String(h));
    } catch {
      /* ignore */
    }
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_COLLAPSED, next ? "1" : "0");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  React.useEffect(() => {
    if (!dragging) return;

    const onMove = (e: PointerEvent) => {
      const delta = dragStartXRef.current - e.clientX;
      const next = clampPanelWidth(dragStartWidthRef.current + delta, window.innerWidth);
      setPanelWidthPx(next);
    };

    const onUp = () => {
      setDragging(false);
      setPanelWidthPx((w) => {
        const clamped = clampPanelWidth(w, window.innerWidth);
        persistWidth(clamped);
        return clamped;
      });
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);

    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
  }, [dragging, persistWidth]);

  React.useEffect(() => {
    if (!notesDragging) return;
    const onMove = (e: PointerEvent) => {
      const delta = e.clientY - notesStartYRef.current;
      const available = notesAreaRef.current?.clientHeight ?? 520;
      const next = clampNotesHeight(notesStartHeightRef.current + delta, available);
      setNotesHeightPx(next);
    };
    const onUp = () => {
      setNotesDragging(false);
      setNotesHeightPx((h) => {
        const available = notesAreaRef.current?.clientHeight ?? 520;
        const clamped = clampNotesHeight(h, available);
        persistNotesHeight(clamped);
        return clamped;
      });
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
  }, [notesDragging, persistNotesHeight]);

  React.useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!aiDraggingRef.current) return;
      const delta = e.clientY - aiStartYRef.current;
      const available = rightBodyRef.current?.clientHeight ?? 640;
      const next = clampAiHeight(aiStartHeightRef.current + delta, available);
      setAiHeightPx(next);
    };
    const onUp = () => {
      if (!aiDraggingRef.current) return;
      aiDraggingRef.current = false;
      setAiHeightPx((h) => {
        const available = rightBodyRef.current?.clientHeight ?? 640;
        const clamped = clampAiHeight(h, available);
        persistAiHeight(clamped);
        return clamped;
      });
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
    };
  }, [persistAiHeight]);

  const onResizePointerDown = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (collapsed) return;
      e.preventDefault();
      dragStartXRef.current = e.clientX;
      dragStartWidthRef.current = panelWidthPx;
      e.currentTarget.setPointerCapture(e.pointerId);
      setDragging(true);
    },
    [collapsed, panelWidthPx],
  );

  const onNotesResizePointerDown = React.useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    notesStartYRef.current = e.clientY;
    notesStartHeightRef.current = notesHeightPx;
    e.currentTarget.setPointerCapture(e.pointerId);
    setNotesDragging(true);
  }, [notesHeightPx]);

  const onAiResizeMouseDown = React.useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    aiDraggingRef.current = true;
    aiStartYRef.current = e.clientY;
    aiStartHeightRef.current = aiHeightPx;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
  }, [aiHeightPx]);

  React.useEffect(() => {
    const onResize = () => {
      setPanelWidthPx((w) => clampPanelWidth(w, window.innerWidth));
      setAiHeightPx((h) => {
        const available = rightBodyRef.current?.clientHeight ?? 640;
        return clampAiHeight(h, available);
      });
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const asideWidth = collapsed ? COLLAPSED_WIDTH_PX : panelWidthPx;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-x-auto">
      <div className="min-h-0 min-w-0 max-w-full flex-1 basis-0 py-5">{children}</div>

      {!collapsed ? (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize workspace side panel"
          className={cn(
            "relative z-10 w-1.5 shrink-0 touch-none",
            "cursor-col-resize border-l border-border/60 bg-border/30",
            "hover:border-border hover:bg-muted",
            dragging && "border-primary/40 bg-muted",
          )}
          onPointerDown={onResizePointerDown}
        />
      ) : null}

      <aside
        className="flex min-h-0 shrink-0 flex-col border-l border-border bg-card shadow-sm transition-[width] duration-200 ease-out"
        style={{ width: asideWidth }}
        aria-label="Workspace AI, notes, and chat panel"
        data-state={collapsed ? "collapsed" : "expanded"}
      >
        <div
          className={cn(
            "flex h-10 shrink-0 items-center gap-1 border-b border-border bg-muted/40 px-2",
            collapsed && "justify-center px-1",
          )}
        >
          {!collapsed && (
            <span className="min-w-0 flex-1 truncate pl-1 text-xs font-medium text-foreground">
              AI · case notes{chatSlot ? " · chat" : ""}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand panel" : "Collapse panel"}
          >
            {collapsed ? (
              <ChevronLeft className="size-4" aria-hidden />
            ) : (
              <ChevronRight className="size-4" aria-hidden />
            )}
          </Button>
        </div>

        {!collapsed && (
          <div ref={rightBodyRef} className="flex h-full min-h-0 flex-1 flex-col overflow-hidden p-2.5">
            <div
              className="flex min-h-0 shrink-0 flex-col overflow-y-auto overflow-x-hidden"
              style={{ height: aiHeightPx }}
            >
              <WorkspaceEvidenceAiPanel />
            </div>
            <div
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize AI panel"
              onMouseDown={onAiResizeMouseDown}
              className="h-[3px] shrink-0 cursor-row-resize border-y border-border/60 bg-border/30"
            />
            <div ref={notesAreaRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <div className="flex flex-shrink-0 flex-col overflow-hidden py-2.5" style={{ height: notesHeightPx }}>
                <p className="mb-1 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Case notes
                </p>
                <div className="flex min-h-0 flex-shrink-0 flex-1 flex-col overflow-hidden pr-0.5">
                  <WorkspaceNotesPanel ownerKey={notesOwnerKey} canDelete={canDelete} density="compact" />
                </div>
              </div>
              {chatSlot ? (
                <>
                  <div
                    role="separator"
                    aria-orientation="horizontal"
                    aria-label="Resize notes and chat"
                    onPointerDown={onNotesResizePointerDown}
                    className="h-2 shrink-0 cursor-row-resize border-y border-border/60 bg-border/30"
                  />
                  <div className="flex flex-1 min-h-0 flex-col overflow-hidden border-t border-border/80 pt-2.5">
                    <div className="mb-1 flex items-center justify-between gap-2">
                      <p className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Workspace chat
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[10px]"
                        onClick={() => setChatCollapsed((v) => !v)}
                      >
                        {chatCollapsed ? "Show" : "Hide"}
                      </Button>
                    </div>
                    {!chatCollapsed ? <div className="flex-1 min-h-0 overflow-hidden">{chatSlot}</div> : null}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
