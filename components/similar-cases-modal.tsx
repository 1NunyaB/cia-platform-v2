"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { CaseSimilarSuggestion } from "@/services/case-suggestions";

export function SimilarCasesModal({
  open,
  onOpenChange,
  draftTitle,
  suggestions,
  onJoin,
  onCreateAnyway,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draftTitle: string;
  suggestions: CaseSimilarSuggestion[];
  onJoin: (caseId: string) => void;
  onCreateAnyway: () => void;
  busy?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg">
        <div className="border-b border-border/80 bg-muted/10 px-6 py-5">
          <DialogHeader>
            <DialogTitle>Similar investigations</DialogTitle>
            <DialogDescription>
              These existing files look related to{" "}
              <span className="font-medium text-foreground">&ldquo;{draftTitle.trim() || "…"}&rdquo;</span>. You can
              contribute there or start a separate file if the scope is different.
            </DialogDescription>
          </DialogHeader>
        </div>
        <ul className="max-h-[min(52vh,22rem)] divide-y overflow-y-auto px-2">
          {suggestions.map((s) => (
            <li key={s.id} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium leading-snug">{s.title}</p>
                {s.description ? (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{s.description}</p>
                ) : null}
                <p className="text-[11px] text-muted-foreground mt-1">
                  Updated {new Date(s.updated_at).toLocaleString(undefined, { dateStyle: "medium" })}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                className="mt-2 shrink-0 sm:mt-0"
                onClick={() => onJoin(s.id)}
                disabled={busy}
              >
                Add to this investigation
              </Button>
            </li>
          ))}
        </ul>
        <DialogFooter className="flex-col gap-2 border-t border-border/80 bg-muted/5 px-6 py-4 sm:flex-row sm:justify-between">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" variant="outline" onClick={onCreateAnyway} disabled={busy}>
            {busy ? "Creating…" : "Create new investigation anyway"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
