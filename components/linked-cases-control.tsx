"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

/**
 * Multi-case link editor: anchored panel with checkboxes; each toggle POSTs immediately.
 */
export function LinkedCasesControl({
  evidenceId,
  cases,
  initialLinkedCaseIds,
  canManage = true,
  contextCaseId = null,
}: {
  evidenceId: string;
  cases: { id: string; title: string }[];
  initialLinkedCaseIds: string[];
  canManage?: boolean;
  /** When unlinked from this case, navigate to library evidence URL. */
  contextCaseId?: string | null;
}) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [linked, setLinked] = useState<Set<string>>(() => new Set(initialLinkedCaseIds));
  const linkedRef = useRef(linked);
  const [busyCaseId, setBusyCaseId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    linkedRef.current = linked;
  }, [linked]);

  const linkedIdsKey = [...initialLinkedCaseIds].sort().join("|");
  useEffect(() => {
    setLinked(new Set(initialLinkedCaseIds));
  }, [evidenceId, linkedIdsKey, initialLinkedCaseIds]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const persist = useCallback(
    async (caseId: string, linkedFlag: boolean) => {
      const prev = new Set(linkedRef.current);
      const next = new Set(prev);
      if (linkedFlag) next.add(caseId);
      else next.delete(caseId);
      setLinked(next);
      setBusyCaseId(caseId);
      setError(null);
      try {
        const res = await fetch(`/api/evidence/${evidenceId}/case-links`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ caseId, linked: linkedFlag }),
        });
        const data = (await res.json().catch(() => ({}))) as { error?: string; linkedCaseIds?: string[] };
        if (!res.ok) {
          setLinked(prev);
          setError(data.error ?? "Could not update case link.");
          return;
        }
        if (Array.isArray(data.linkedCaseIds)) {
          setLinked(new Set(data.linkedCaseIds));
        }
        if (contextCaseId && data.linkedCaseIds && !data.linkedCaseIds.includes(contextCaseId)) {
          router.push(`/evidence/${evidenceId}`);
          return;
        }
        router.refresh();
      } catch {
        setLinked(prev);
        setError("Network error — try again.");
      } finally {
        setBusyCaseId(null);
      }
    },
    [evidenceId, router, contextCaseId],
  );

  if (!canManage && initialLinkedCaseIds.length === 0) {
    return null;
  }

  if (!canManage) {
    return (
      <p className="text-[11px] text-muted-foreground">
        Linked to {initialLinkedCaseIds.length} investigation{initialLinkedCaseIds.length === 1 ? "" : "s"}. Only the
        uploader can change links here.
      </p>
    );
  }

  return (
    <div ref={wrapRef} className="relative inline-block text-left">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 border-sky-400/80 bg-white text-xs font-semibold text-foreground hover:bg-sky-50"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        Linked Cases
      </Button>
      {open ? (
        <div
          className="absolute left-0 z-50 mt-1 max-h-64 w-[min(100vw-2rem,22rem)] overflow-y-auto rounded-md border border-border bg-card p-2 shadow-md"
          role="dialog"
          aria-label="Link evidence to investigations"
        >
          <p className="mb-2 px-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Saves immediately
          </p>
          {cases.length === 0 ? (
            <p className="px-1 text-xs text-muted-foreground">No investigations available.</p>
          ) : (
            <ul className="space-y-0.5">
              {cases.map((c) => {
                const checked = linked.has(c.id);
                const busy = busyCaseId === c.id;
                return (
                  <li key={c.id} className="flex items-start gap-2 rounded px-1 py-1 hover:bg-muted/50">
                    <input
                      type="checkbox"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-input"
                      checked={checked}
                      disabled={busyCaseId !== null}
                      onChange={(e) => void persist(c.id, e.target.checked)}
                      id={`linked-case-${evidenceId}-${c.id}`}
                    />
                    <label
                      htmlFor={`linked-case-${evidenceId}-${c.id}`}
                      className="min-w-0 flex-1 cursor-pointer text-xs leading-snug"
                    >
                      <span className="font-medium text-foreground">{c.title}</span>
                      <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">{c.id}</span>
                      {busy ? <span className="text-[10px] text-muted-foreground">Saving…</span> : null}
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
      {error ? <p className="mt-1 max-w-xs text-xs font-medium text-red-700 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
