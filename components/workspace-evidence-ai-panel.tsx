"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Bot, Loader2, Sparkles, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { parseWorkspaceRouteContext } from "@/lib/workspace-route-context";
import {
  WORKSPACE_AI_ATTACH_EVENT,
  WORKSPACE_AI_DRAG_MIME,
  readEvidenceIdFromDataTransfer,
  type WorkspaceAiAttachDetail,
} from "@/lib/workspace-evidence-ai-bridge";
import { cn } from "@/lib/utils";

const MAX_ATTACHED = 15;

type AttachedEvidence = {
  evidenceId: string;
  caseId: string | null;
  label: string;
  mimeType?: string | null;
};

type AssistApiRow = AttachedEvidence & { id?: string; compareHref?: string };

export function WorkspaceEvidenceAiPanel() {
  const pathname = usePathname();
  const route = React.useMemo(() => parseWorkspaceRouteContext(pathname), [pathname]);

  const [attached, setAttached] = React.useState<AttachedEvidence[]>([]);
  const [prompt, setPrompt] = React.useState("");
  const [reply, setReply] = React.useState<string | null>(null);
  const [loadingBrief, setLoadingBrief] = React.useState(false);
  const [loadingAsk, setLoadingAsk] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [selectedCaseContext, setSelectedCaseContext] = React.useState<string | null>(route.caseId ?? null);

  const loadEvidenceMeta = React.useCallback(
    async (evidenceIds: string[], fallbackCaseId: string | null, opts?: { signal?: AbortSignal }) => {
      const unique = [...new Set(evidenceIds.map((id) => id.trim()).filter(Boolean))].slice(0, MAX_ATTACHED);
      if (unique.length === 0) return;

      setLoadingBrief(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/workspace/evidence-assist?evidenceIds=${encodeURIComponent(unique.join(","))}`,
          { signal: opts?.signal, credentials: "include" },
        );
        const data = (await res.json()) as {
          error?: string;
          items?: AssistApiRow[];
        };
        if (!res.ok) {
          setError(data.error ?? "Could not load evidence");
          return;
        }
        const items = data.items ?? [];
        setAttached(
          items.map((row) => ({
            evidenceId: row.evidenceId ?? row.id ?? "",
            caseId: row.caseId ?? fallbackCaseId,
            label: row.label,
            mimeType: row.mimeType ?? null,
          })).filter((row) => row.evidenceId),
        );
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("Network error loading evidence");
      } finally {
        setLoadingBrief(false);
      }
    },
    [],
  );

  const requestAssist = React.useCallback(async (evidenceIds: string[], caseContext: string | null, message: string) => {
    const res = await fetch("/api/workspace/evidence-assist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        evidenceIds,
        caseId: caseContext ?? undefined,
        pageContext: route.pageKind,
        message,
      }),
    });
    const data = (await res.json()) as { error?: string; reply?: string; code?: string };
    if (!res.ok) {
      if (res.status === 503 || data.code === "ai_unconfigured" || data.code === "ai_unavailable") {
        setError("AI is not configured yet.");
        return;
      }
      setError(data.error ?? "Could not reach the assistant.");
      return;
    }
    setReply(data.reply ?? "");
  }, [route.pageKind]);

  React.useEffect(() => {
    const onAttach = (e: Event) => {
      const d = (e as CustomEvent<WorkspaceAiAttachDetail>).detail;
      if (!d) return;
      setSelectedCaseContext(d.caseId ?? route.caseId ?? null);
      setReply(null);
      if (d.prompt?.trim()) setPrompt(d.prompt);
      if (d.evidenceIds && d.evidenceIds.length > 0) {
        void (async () => {
          await loadEvidenceMeta(d.evidenceIds!, d.caseId ?? route.caseId);
          if (d.autoRun && d.prompt?.trim()) {
            setLoadingAsk(true);
            setError(null);
            try {
              await requestAssist(d.evidenceIds!, d.caseId ?? route.caseId ?? null, d.prompt.trim());
            } catch {
              setError("Network error");
            } finally {
              setLoadingAsk(false);
            }
          }
        })();
        return;
      }
      if (d.evidenceId?.trim()) {
        const singleId = d.evidenceId.trim();
        void (async () => {
          await loadEvidenceMeta([singleId], d.caseId ?? route.caseId);
          if (d.autoRun && d.prompt?.trim()) {
            setLoadingAsk(true);
            setError(null);
            try {
              await requestAssist([singleId], d.caseId ?? route.caseId ?? null, d.prompt.trim());
            } catch {
              setError("Network error");
            } finally {
              setLoadingAsk(false);
            }
          }
        })();
        return;
      }
      setError(null);
    };
    window.addEventListener(WORKSPACE_AI_ATTACH_EVENT, onAttach);
    return () => window.removeEventListener(WORKSPACE_AI_ATTACH_EVENT, onAttach);
  }, [loadEvidenceMeta, requestAssist, route.caseId]);

  /** When the URL is an evidence view, sync attachment (metadata from API). */
  React.useEffect(() => {
    const eid = route.evidenceId;
    if (!eid) return;
    const ac = new AbortController();
    void loadEvidenceMeta([eid], route.caseId, { signal: ac.signal });
    return () => ac.abort();
  }, [route.evidenceId, route.caseId, loadEvidenceMeta]);

  const mergeDropId = React.useCallback(
    (droppedId: string) => {
      setReply(null);
      setError(null);
      setAttached((prev) => {
        const existing = new Set(prev.map((a) => a.evidenceId));
        if (existing.has(droppedId)) return prev;
        const nextIds = [...prev.map((a) => a.evidenceId), droppedId].slice(0, MAX_ATTACHED);
        void loadEvidenceMeta(nextIds, route.caseId);
        return prev;
      });
    },
    [loadEvidenceMeta, route.caseId],
  );

  const onDrop = React.useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const id = readEvidenceIdFromDataTransfer(e.dataTransfer);
      if (!id) {
        setError('Drop a file row from the evidence list (or use "Send to AI").');
        return;
      }
      mergeDropId(id);
    },
    [mergeDropId],
  );

  function removeAt(index: number) {
    setAttached((prev) => prev.filter((_, i) => i !== index));
    setReply(null);
  }

  function clearAll() {
    setAttached([]);
    setReply(null);
    setError(null);
  }

  async function submitAsk() {
    if (attached.length === 0 || !prompt.trim()) return;
    setLoadingAsk(true);
    setError(null);
    try {
      await requestAssist(
        attached.map((a) => a.evidenceId),
        selectedCaseContext ?? route.caseId ?? attached.find((a) => a.caseId)?.caseId ?? null,
        prompt.trim(),
      );
    } catch {
      setError("Network error");
    } finally {
      setLoadingAsk(false);
    }
  }

  const preset = (text: string) => {
    setPrompt(text);
    setReply(null);
  };

  const onDashboard = route.pageKind === "dashboard";

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-2" aria-label="Evidence AI assistant">
      <div className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-foreground">
        <Bot className="size-3.5 shrink-0 text-sky-800" aria-hidden />
        <span>Agent AI</span>
        {!onDashboard ? (
          <span className="font-normal text-muted-foreground">— summary, clues, timeline connections</span>
        ) : null}
      </div>
      {selectedCaseContext ? (
        <p className="shrink-0 text-[10px] text-muted-foreground">
          Case: <span className="font-mono text-foreground">{selectedCaseContext.slice(0, 8)}…</span>
        </p>
      ) : null}

      {!onDashboard ? (
        <p className="shrink-0 text-[10px] leading-snug text-muted-foreground">
          Uses <strong className="font-medium text-foreground/90">selected evidence</strong>,{" "}
          <strong className="font-medium text-foreground/90">case context</strong> when you are in a case, and file{" "}
          <strong className="font-medium text-foreground/90">metadata</strong> (plus image previews for image files).
          No text extraction is required.
        </p>
      ) : (
        <p className="shrink-0 text-[10px] text-muted-foreground">Attach evidence from the feed, then ask.</p>
      )}

      <div
        className={cn(
          "relative shrink-0 rounded-md border-2 border-dashed px-2 py-2 transition-colors",
          dragOver ? "border-sky-600 bg-sky-50" : "border-border bg-muted/20",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        <div className="flex items-start gap-2">
          <Upload className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-medium text-foreground">
              {onDashboard ? (
                <>Drop list rows here or use Send to AI.</>
              ) : (
                <>
                  Drop evidence rows here, or use <span className="font-semibold">Send to AI</span> / bulk{" "}
                  <span className="font-semibold">Send to AI</span>
                </>
              )}
            </p>
            {!onDashboard ? (
              <p className="text-[10px] text-muted-foreground">
                Each drop adds this file to the selection (up to {MAX_ATTACHED}). Open an evidence page to focus one file.
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground">Up to {MAX_ATTACHED} files.</p>
            )}
          </div>
        </div>

        {loadingBrief ? (
          <p className="mt-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
            <Loader2 className="size-3 animate-spin" aria-hidden />
            Loading attachment…
          </p>
        ) : attached.length > 0 ? (
          <ul className="mt-2 max-h-[min(22vh,180px)] space-y-1.5 overflow-y-auto pr-0.5">
            {attached.map((a, i) => (
              <li
                key={a.evidenceId}
                className="flex flex-wrap items-center gap-2 rounded border border-sky-300/80 bg-sky-50/90 px-2 py-1.5"
              >
                <Sparkles className="size-3 shrink-0 text-sky-900" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-sky-950">{a.label}</p>
                  <p className="text-[10px] text-sky-900/90">
                    <span className="font-mono">{a.evidenceId.slice(0, 8)}…</span>
                    {a.mimeType ? <span> · {a.mimeType}</span> : null}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-sky-950 hover:bg-sky-200/60"
                  aria-label={`Remove ${a.label}`}
                  onClick={() => removeAt(i)}
                >
                  <X className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[10px] text-amber-900/90">
            No files attached — drop rows, use Send to AI, or open an evidence page.
          </p>
        )}

        {attached.length > 0 ? (
          <button
            type="button"
            className="mt-2 text-[10px] font-medium text-sky-900 underline decoration-sky-700/70 underline-offset-2"
            onClick={clearAll}
          >
            Clear all
          </button>
        ) : null}
      </div>

      <div className="shrink-0 flex flex-wrap gap-1">
        <span className="w-full text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Quick prompts</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[10px]"
          disabled={attached.length === 0}
          onClick={() =>
            preset(
              "Give a concise summary of what these items are (from metadata and any images), and what is unknown.",
            )
          }
        >
          Summary
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[10px]"
          disabled={attached.length === 0}
          onClick={() =>
            preset(
              "List factual observations from metadata (and visible image content only). Label uncertainty clearly.",
            )
          }
        >
          Observations
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[10px]"
          disabled={attached.length === 0}
          onClick={() =>
            preset(
              "Suggest tentative clues or hypotheses worth testing (not conclusions). Note verification steps.",
            )
          }
        >
          Clues
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 px-2 text-[10px]"
          disabled={attached.length === 0}
          onClick={() =>
            preset(
              "Recommend practical next steps for the investigator (compare files, follow-up requests, timeline checks).",
            )
          }
        >
          Next steps
        </Button>
      </div>

      <Textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Ask for summary, clues, timeline connections"
        className="min-h-[72px] shrink-0 resize-y text-xs"
        disabled={attached.length === 0 || loadingAsk}
        aria-label="Message to AI assistant"
      />

      <Button
        type="button"
        size="sm"
        className="h-8 w-full shrink-0 gap-1.5 bg-sky-800 text-white hover:bg-sky-900"
        disabled={attached.length === 0 || !prompt.trim() || loadingAsk}
        onClick={() => void submitAsk()}
      >
        {loadingAsk ? (
          <>
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Thinking…
          </>
        ) : (
          <>
            <Sparkles className="size-3.5" aria-hidden />
            Ask AI
          </>
        )}
      </Button>

      {error ? (
        <p className="shrink-0 rounded border border-red-300 bg-red-50 px-2 py-1 text-[10px] font-medium text-red-950">
          {error}
        </p>
      ) : null}

      {reply ? (
        <div className="min-h-0 flex-1 overflow-y-auto rounded-md border border-border bg-background px-2 py-2">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Reply</p>
          <pre className="whitespace-pre-wrap break-words font-sans text-[11px] leading-relaxed text-foreground">
            {reply}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
