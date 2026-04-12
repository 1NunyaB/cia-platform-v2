"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
/**
 * Wraps readable content (e.g. extracted text). On text selection, shows actions to search the case,
 * the full evidence database, entities/registry, and timelines using the selection as the query.
 */
export function EvidenceTextSelectionSearch({
  caseId,
  children,
}: {
  /** Null on library-only evidence view — case-scoped search buttons are hidden. */
  caseId: string | null;
  children: React.ReactNode;
}) {
  const [selection, setSelection] = useState("");

  const refreshSelection = useCallback(() => {
    const t = typeof window !== "undefined" ? window.getSelection()?.toString().trim() ?? "" : "";
    setSelection(t);
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", refreshSelection);
    return () => document.removeEventListener("selectionchange", refreshSelection);
  }, [refreshSelection]);

  const q = encodeURIComponent(selection);
  const show = selection.length >= 2;

  return (
    <div className="relative space-y-2">
      <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
        <Search className="h-3.5 w-3.5 shrink-0 text-sky-500/80" aria-hidden />
        Select text below, then search without retyping.
      </p>
      {show ? (
        <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border border-sky-500/35 bg-zinc-950/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
          <span className="text-zinc-400 max-w-[min(100%,14rem)] truncate" title={selection}>
            “{selection.slice(0, 80)}
            {selection.length > 80 ? "…" : ""}”
          </span>
          {caseId ? (
            <>
              <Link
                href={`/cases/${caseId}/entities?q=${q}`}
                className="rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-sky-300 hover:bg-zinc-800"
              >
                Case — entities & registry
              </Link>
              <Link
                href={`/cases/${caseId}/timeline?q=${q}`}
                className="rounded border border-zinc-600 bg-zinc-900 px-2 py-1 text-sky-300 hover:bg-zinc-800"
              >
                Case — timelines
              </Link>
            </>
          ) : null}
          <Link
            href={`/evidence?q=${q}`}
            className="rounded border border-sky-600/50 bg-sky-950/50 px-2 py-1 text-sky-200 hover:bg-sky-950/80"
          >
            All evidence (database)
          </Link>
        </div>
      ) : null}
      <div onMouseUp={refreshSelection} className="rounded-md">
        {children}
      </div>
    </div>
  );
}
