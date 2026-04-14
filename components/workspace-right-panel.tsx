"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceEvidenceAiPanel } from "@/components/workspace-evidence-ai-panel";
import { WorkspaceNotesPanel } from "@/components/workspace-notes-panel";
import { cn } from "@/lib/utils";

const STORAGE_COLLAPSED = "cia.workspace.rightPanel.collapsed";
const STORAGE_WIDTH = "cia.workspace.rightPanel.widthPx";

/** Default ~304px — within 280–340px target; main keeps ~60%+ when root max-width is ~1400px. */
const DEFAULT_PANEL_WIDTH = 304;
const COLLAPSED_WIDTH_PX = 52;
const MIN_PANEL = 240;
const MAX_PANEL = 420;
/** Do not let the panel exceed this fraction of the viewport width. */
const MAX_VIEWPORT_FRACTION = 0.38;

function clampPanelWidth(px: number, viewportWidth: number): number {
  const maxByViewport = Math.min(MAX_PANEL, Math.floor(viewportWidth * MAX_VIEWPORT_FRACTION));
  const minAllowed = MIN_PANEL;
  if (maxByViewport < minAllowed) {
    return Math.min(minAllowed, Math.max(200, maxByViewport));
  }
  return Math.max(minAllowed, Math.min(maxByViewport, Math.round(px)));
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
  const [panelWidthPx, setPanelWidthPx] = React.useState(DEFAULT_PANEL_WIDTH);
  const [dragging, setDragging] = React.useState(false);
  const dragStartXRef = React.useRef(0);
  const dragStartWidthRef = React.useRef(DEFAULT_PANEL_WIDTH);
  React.useEffect(() => {
    try {
      const c = localStorage.getItem(STORAGE_COLLAPSED);
      if (c === "1") setCollapsed(true);
      const w = localStorage.getItem(STORAGE_WIDTH);
      if (w != null) {
        const parsed = Number.parseInt(w, 10);
        if (!Number.isNaN(parsed)) {
          setPanelWidthPx(clampPanelWidth(parsed, typeof window !== "undefined" ? window.innerWidth : 1200));
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

  React.useEffect(() => {
    const onResize = () => {
      setPanelWidthPx((w) => clampPanelWidth(w, window.innerWidth));
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const asideWidth = collapsed ? COLLAPSED_WIDTH_PX : panelWidthPx;

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-row overflow-x-auto">
      <div className="min-h-0 min-w-0 max-w-full flex-1 basis-0 py-8">{children}</div>

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
        className={cn(
          "flex min-h-0 shrink-0 flex-col border-l border-border bg-card shadow-sm",
          !dragging && "transition-[width] duration-200 ease-out",
        )}
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
              AI · notes{chatSlot ? " · chat" : ""}
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
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3">
            <div className="flex min-h-[28vh] flex-1 flex-col overflow-hidden">
              <WorkspaceEvidenceAiPanel />
            </div>
            <div className="mt-3 flex max-h-[min(9vh,68px)] min-h-0 shrink-0 flex-col overflow-hidden border-t border-border pt-3">
              <p className="mb-1 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Notes
              </p>
              <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">
                <WorkspaceNotesPanel ownerKey={notesOwnerKey} canDelete={canDelete} density="compact" />
              </div>
            </div>
            {chatSlot ? (
              <div className="mt-3 flex min-h-0 min-h-[10rem] flex-1 flex-col overflow-hidden border-t border-border pt-3">
                <p className="mb-1 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Workplace chat
                </p>
                <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pr-0.5">{chatSlot}</div>
              </div>
            ) : null}
          </div>
        )}
      </aside>
    </div>
  );
}
