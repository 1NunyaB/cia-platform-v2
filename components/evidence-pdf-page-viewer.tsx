"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvestigationLoadingIndicator } from "@/components/investigation-loading-indicator";
import { PDFJS_DIST_VERSION } from "@/lib/pdfjs-version";
import {
  INVESTIGATION_STACK_KINDS,
  INVESTIGATION_STACK_LABEL,
  type InvestigationStackKind,
} from "@/lib/investigation-stacks";

type PdfDoc = import("pdfjs-dist").PDFDocumentProxy;
type PdfLoadingTask = import("pdfjs-dist").PDFDocumentLoadingTask;

/** Checkbox grid for multi-select; larger PDFs can still use per-page + range controls. */
const LIST_MAX_PAGES_UI = 200;
const MAX_PAGES_PER_EXTRACT = 100;

export function EvidencePdfPageViewer({
  evidenceId,
  streamUrl,
  filename,
  caseId = null,
}: {
  evidenceId: string;
  streamUrl: string;
  filename: string;
  /** When set, user can attach new page evidence to a case stack in one step. */
  caseId?: string | null;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const pdfRef = useRef<PdfDoc | null>(null);
  const renderTaskRef = useRef<{ cancel?: () => void } | null>(null);

  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [jumpDraft, setJumpDraft] = useState("1");
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [clusters, setClusters] = useState<{ id: string; title: string | null }[]>([]);
  const [clusterChoice, setClusterChoice] = useState<string>("");
  const [stackKinds, setStackKinds] = useState<Set<InvestigationStackKind>>(() => new Set());
  const [rangeFrom, setRangeFrom] = useState("1");
  const [rangeTo, setRangeTo] = useState("1");

  const togglePage = useCallback((page: number, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(page);
      else next.delete(page);
      return next;
    });
  }, []);

  const toggleCurrent = useCallback(
    (on: boolean) => {
      togglePage(currentPage, on);
    },
    [currentPage, togglePage],
  );

  useEffect(() => {
    setJumpDraft(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    if (!caseId) {
      setClusters([]);
      setClusterChoice("");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/cases/${caseId}/clusters`);
        const data = (await res.json()) as { clusters?: { id: string; title: string | null }[]; error?: string };
        if (!res.ok || !data.clusters) {
          if (!cancelled) setClusters([]);
          return;
        }
        if (!cancelled) setClusters(data.clusters);
      } catch {
        if (!cancelled) setClusters([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [caseId]);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: PdfLoadingTask | null = null;

    pdfRef.current = null;
    setLoadError(null);
    setLoadingDoc(true);
    setNumPages(0);
    setCurrentPage(1);
    setSelected(new Set());
    setStackKinds(new Set());

    (async () => {
      try {
        const res = await fetch(streamUrl, { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setLoadError(`Could not load PDF (${res.status}).`);
          return;
        }
        const buf = await res.arrayBuffer();
        const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
        GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_DIST_VERSION}/build/pdf.worker.mjs`;

        loadingTask = getDocument({ data: new Uint8Array(buf) });
        const pdf = await loadingTask.promise;
        if (cancelled) {
          await pdf.destroy().catch(() => {});
          return;
        }
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setRangeFrom("1");
        setRangeTo(String(pdf.numPages));
      } catch {
        if (!cancelled) setLoadError("Could not open this PDF in the viewer.");
      } finally {
        if (!cancelled) setLoadingDoc(false);
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
      renderTaskRef.current = null;
      void pdfRef.current?.destroy().catch(() => {});
      pdfRef.current = null;
      if (loadingTask && typeof loadingTask.destroy === "function") {
        void loadingTask.destroy();
      }
    };
  }, [streamUrl]);

  useEffect(() => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || numPages < 1 || currentPage < 1 || currentPage > numPages) return;

    let cancelled = false;
    renderTaskRef.current?.cancel?.();
    renderTaskRef.current = null;

    (async () => {
      try {
        const page = await pdf.getPage(currentPage);
        if (cancelled) {
          page.cleanup();
          return;
        }
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 2);
        const baseScale = 1.35;
        const scale = baseScale * dpr;
        const viewport = page.getViewport({ scale });
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        canvas.style.width = `${Math.floor(viewport.width / dpr)}px`;
        canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const task = page.render({ canvas, viewport });
        renderTaskRef.current = task;
        await task.promise;
        if (cancelled) return;
        page.cleanup();
      } catch {
        /* cancelled mid-render */
      }
    })();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel?.();
      renderTaskRef.current = null;
    };
  }, [currentPage, numPages, loadingDoc]);

  const selectedSorted = [...selected].sort((a, b) => a - b);

  function applyPageRange() {
    const a = parseInt(rangeFrom, 10);
    const b = parseInt(rangeTo, 10);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      setActionError("Enter valid page numbers for the range.");
      return;
    }
    const lo = Math.max(1, Math.min(a, b, numPages));
    const hi = Math.min(numPages, Math.max(a, b));
    const next = new Set(selected);
    let count = 0;
    for (let p = lo; p <= hi; p++) {
      next.add(p);
      count++;
      if (next.size > MAX_PAGES_PER_EXTRACT) break;
    }
    setSelected(next);
    if (count > MAX_PAGES_PER_EXTRACT) {
      setActionError(`Selection capped at ${MAX_PAGES_PER_EXTRACT} pages per request.`);
    } else {
      setActionError(null);
    }
  }

  function toggleStackKind(k: InvestigationStackKind) {
    setStackKinds((prev) => {
      const n = new Set(prev);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });
  }

  async function submitPdfPages(body: {
    pages: number[];
    caseId?: string;
    clusterId?: string;
    stackKinds?: string[];
  }) {
    if (selectedSorted.length === 0) {
      setActionError("Select at least one page.");
      return;
    }
    if (selectedSorted.length > MAX_PAGES_PER_EXTRACT) {
      setActionError(`At most ${MAX_PAGES_PER_EXTRACT} pages per request. Narrow your selection.`);
      return;
    }
    setActionBusy(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/evidence/${evidenceId}/pdf-pages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        created?: { id: string; page: number }[];
        duplicate?: boolean;
        message?: string;
        error?: string;
      };

      if (data.duplicate) {
        setActionError(data.message ?? "That extract already exists.");
        return;
      }
      if (!res.ok) {
        setActionError(data.error ?? "Request failed.");
        return;
      }
      if (!data.created?.length) {
        setActionError("Nothing was created.");
        return;
      }
      setSelected(new Set());
      setStackKinds(new Set());
      router.refresh();
    } catch {
      setActionError("Network error.");
    } finally {
      setActionBusy(false);
    }
  }

  const createPageFilesOnly = () =>
    void submitPdfPages({
      pages: selectedSorted,
      ...(caseId ? { caseId } : {}),
    });

  const createPagesAndAttachToStacks = (legacyClusterId: string | null) => {
    if (!caseId) {
      setActionError("Open this PDF from a case to attach stacks.");
      return;
    }
    const sk = [...stackKinds];
    if (!legacyClusterId && sk.length === 0) {
      setActionError("Choose at least one investigation stack or other cluster.");
      return;
    }
    void submitPdfPages({
      pages: selectedSorted,
      caseId,
      ...(legacyClusterId ? { clusterId: legacyClusterId } : {}),
      ...(sk.length > 0 ? { stackKinds: sk } : {}),
    });
  };

  if (loadError) {
    return (
      <div className="rounded-md border border-amber-700/50 bg-amber-50 px-3 py-2 text-sm text-foreground" role="alert">
        {loadError}
      </div>
    );
  }

  if (loadingDoc || numPages < 1) {
    return (
      <div className="flex min-h-[200px] items-center justify-center rounded-md border border-border bg-white py-8">
        <InvestigationLoadingIndicator inline label="Loading PDF…" />
      </div>
    );
  }

  const showPageList = numPages <= LIST_MAX_PAGES_UI;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-md border border-sky-300/90 bg-sky-50/80 px-2 py-2 text-foreground">
        <span className="text-[11px] font-semibold uppercase tracking-wide">Pages</span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 border-border px-2 text-xs"
          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          disabled={currentPage <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-xs font-medium tabular-nums">
          Page {currentPage} of {numPages}
        </span>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 border-border px-2 text-xs"
          onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
          disabled={currentPage >= numPages}
          aria-label="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <label className="flex items-center gap-1.5 text-xs">
          <span className="text-foreground/90">Go to</span>
          <input
            type="number"
            min={1}
            max={numPages}
            value={jumpDraft}
            onChange={(e) => setJumpDraft(e.target.value)}
            className="h-8 w-14 rounded border border-input bg-white px-2 text-xs text-foreground tabular-nums"
          />
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-8 px-2 text-xs"
            onClick={() => {
              const n = parseInt(jumpDraft, 10);
              if (Number.isFinite(n) && n >= 1 && n <= numPages) setCurrentPage(n);
            }}
          >
            Go
          </Button>
        </label>
        <label className="ml-auto flex cursor-pointer items-center gap-2 text-xs font-medium">
          <input
            type="checkbox"
            checked={selected.has(currentPage)}
            onChange={(e) => toggleCurrent(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-sky-700"
          />
          Select this page
        </label>
        <span className="hidden w-full sm:block sm:w-auto" aria-hidden />
        <div className="flex w-full flex-wrap items-center gap-1.5 border-t border-sky-200/80 pt-2 sm:w-auto sm:border-t-0 sm:pt-0">
          <span className="text-[10px] font-medium text-foreground/90">Range</span>
          <input
            type="number"
            min={1}
            max={numPages}
            value={rangeFrom}
            onChange={(e) => setRangeFrom(e.target.value)}
            className="h-8 w-14 rounded border border-input bg-white px-1.5 text-xs tabular-nums"
            aria-label="Range start page"
          />
          <span className="text-[10px]">–</span>
          <input
            type="number"
            min={1}
            max={numPages}
            value={rangeTo}
            onChange={(e) => setRangeTo(e.target.value)}
            className="h-8 w-14 rounded border border-input bg-white px-1.5 text-xs tabular-nums"
            aria-label="Range end page"
          />
          <Button type="button" size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={applyPageRange}>
            Add range to selection
          </Button>
        </div>
      </div>

      <div className="overflow-auto rounded-md border border-border bg-white p-2 shadow-inner">
        <canvas ref={canvasRef} className="mx-auto block max-w-full bg-white shadow-sm" aria-label={`PDF page ${currentPage}`} />
      </div>

      {showPageList ? (
        <details className="rounded-md border border-border bg-white text-foreground">
          <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold">
            Select pages ({selected.size} selected)
          </summary>
          <div className="max-h-40 overflow-y-auto border-t border-border px-3 py-2">
            <div className="mb-2 flex flex-wrap gap-2 text-[11px]">
              <button
                type="button"
                className="text-sky-800 underline decoration-sky-700/80 underline-offset-2"
                onClick={() =>
                  setSelected(
                    new Set(
                      Array.from({ length: Math.min(numPages, MAX_PAGES_PER_EXTRACT) }, (_, i) => i + 1),
                    ),
                  )
                }
              >
                Select all (max {MAX_PAGES_PER_EXTRACT})
              </button>
              <button
                type="button"
                className="text-sky-800 underline decoration-sky-700/80 underline-offset-2"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </button>
            </div>
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(7rem,1fr))] gap-1.5">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                <li key={p}>
                  <label className="flex cursor-pointer items-center gap-2 rounded border border-transparent px-1 py-0.5 text-xs hover:bg-sky-50/80">
                    <input
                      type="checkbox"
                      checked={selected.has(p)}
                      onChange={(e) => togglePage(p, e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-border accent-sky-700"
                    />
                    <span className="tabular-nums">Page {p}</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>
        </details>
      ) : (
        <p className="text-[11px] text-foreground/85">
          This PDF has {numPages} pages. Use <strong className="font-semibold">Select this page</strong>,{" "}
          <strong className="font-semibold">Add range to selection</strong>, or navigate page-by-page. (Full checkbox
          list is shown for up to {LIST_MAX_PAGES_UI} pages.)
        </p>
      )}

      {selectedSorted.length > 0 ? (
        <p className="text-[11px] text-foreground/90">
          Selected:{" "}
          <span className="font-mono tabular-nums">
            {selectedSorted.slice(0, 24).join(", ")}
            {selectedSorted.length > 24 ? "…" : ""}
          </span>
        </p>
      ) : null}

      <div className="flex flex-col gap-2 rounded-md border border-sky-300/70 bg-white px-3 py-2.5 text-foreground">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">Page evidence</p>
        <p className="text-[10px] leading-snug text-foreground/90">
          Each selected page becomes a <strong className="font-semibold">new</strong> PDF file named{" "}
          <span className="font-mono text-[10px]">{filename.replace(/\.[^.]+$/, "")}__p0001.pdf</span>,{" "}
          <span className="font-mono text-[10px]">__p0002.pdf</span>, … The source file{" "}
          <span className="font-medium">{filename}</span> is <strong className="font-semibold">not</strong> modified.
          Provenance is stored (root original, page number, derivative index).
        </p>
        {caseId ? (
          <div className="rounded-md border border-border bg-sky-50/50 px-2 py-2">
            <p className="text-[10px] font-semibold text-foreground">Investigation stacks (optional)</p>
            <p className="text-[10px] text-foreground/85 mt-0.5">
              After page PDFs are created, they can be added to these stacks in one step.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1.5 sm:grid-cols-3">
              {INVESTIGATION_STACK_KINDS.map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-1.5 text-[10px] text-foreground">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-border accent-sky-700"
                    checked={stackKinds.has(k)}
                    onChange={() => toggleStackKind(k)}
                  />
                  {INVESTIGATION_STACK_LABEL[k]}
                </label>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            className="h-8 bg-sky-700 text-white hover:bg-sky-800"
            disabled={actionBusy}
            onClick={createPageFilesOnly}
          >
            Create page files only
          </Button>
          {caseId && clusters.length > 0 ? (
            <>
              <div className="flex min-w-[12rem] flex-1 flex-col gap-1">
                <label htmlFor={`pdf-stack-${evidenceId}`} className="text-[10px] font-medium text-foreground">
                  Other cluster (optional)
                </label>
                <select
                  id={`pdf-stack-${evidenceId}`}
                  value={clusterChoice}
                  onChange={(e) => setClusterChoice(e.target.value)}
                  className="h-9 rounded-md border border-input bg-form-field px-2 text-sm text-black"
                >
                  <option value="">— None —</option>
                  {clusters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title?.trim() || "Untitled stack"}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 self-end border-sky-400 bg-sky-50 text-xs text-foreground"
                disabled={
                  actionBusy || (!clusterChoice && stackKinds.size === 0) || selectedSorted.length === 0
                }
                onClick={() => createPagesAndAttachToStacks(clusterChoice || null)}
              >
                Create &amp; add to stack(s)
              </Button>
            </>
          ) : caseId ? (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-8 border-sky-400 bg-sky-50 text-xs text-foreground"
              disabled={actionBusy || stackKinds.size === 0 || selectedSorted.length === 0}
              onClick={() => createPagesAndAttachToStacks(null)}
            >
              Create &amp; add to stack(s)
            </Button>
          ) : (
            <p className="self-center text-[10px] text-foreground/80">
              Open this file from a case to attach new page files to investigation stacks.
            </p>
          )}
        </div>
        {actionError ? (
          <p className="text-xs text-red-800" role="alert">
            {actionError}
          </p>
        ) : null}
        {actionBusy ? <InvestigationLoadingIndicator inline label="Creating…" className="text-xs" /> : null}
      </div>
    </div>
  );
}
