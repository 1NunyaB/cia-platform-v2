"use client";

import { useEffect, useRef, useState } from "react";
import { InvestigationLoadingIndicator } from "@/components/investigation-loading-indicator";
import { Button } from "@/components/ui/button";

const DEBUG = process.env.NODE_ENV === "development";

type Props = {
  evidenceId: string;
  /** Same-origin path e.g. `/api/evidence/{id}/file` (cookie session). */
  streamUrl: string;
  filename: string;
  className?: string;
};

function PreviewUnavailable({ streamUrl, detail }: { streamUrl: string; detail?: string }) {
  return (
    <div
      className="rounded-lg border-2 border-amber-700/40 bg-amber-50 px-4 py-4 text-sm text-foreground"
      role="status"
    >
      <p className="font-semibold text-foreground">Preview unavailable. Click to open file.</p>
      {detail ? <p className="mt-1 text-sm text-foreground/95">{detail}</p> : null}
      <div className="mt-4">
        <Button
          asChild
          type="button"
          variant="secondary"
          size="sm"
          className="border-sky-600 bg-white text-foreground shadow-sm hover:bg-sky-50"
        >
          <a href={streamUrl} target="_blank" rel="noopener noreferrer">
            Open file
          </a>
        </Button>
      </div>
    </div>
  );
}

/**
 * Inline PDF via same-origin byte stream → blob URL → iframe/object. Does not use signed Supabase URLs in the
 * viewer (avoids CORS / worker fetch failures with PDF.js). Independent of text extraction.
 */
export function EvidencePdfInlinePreview({ evidenceId, streamUrl, filename, className }: Props) {
  const [phase, setPhase] = useState<"loading" | "ready" | "error">("loading");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    setBlobUrl(null);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    (async () => {
      try {
        if (DEBUG) {
          console.info("[pdf-preview] fetching stream", { evidenceId, streamUrl });
        }
        const res = await fetch(streamUrl, { credentials: "same-origin" });
        if (!res.ok) {
          const errBody = await res.text().catch(() => "");
          if (DEBUG) {
            console.warn("[pdf-preview] stream response not OK", {
              status: res.status,
              bodyPreview: errBody.slice(0, 400),
            });
          }
          if (!cancelled) setPhase("error");
          return;
        }
        const blob = await res.blob();
        if (DEBUG) {
          console.info("[pdf-preview] blob received", { size: blob.size, type: blob.type });
        }
        if (cancelled) return;
        if (blob.size === 0) {
          if (DEBUG) console.warn("[pdf-preview] empty blob");
          if (!cancelled) setPhase("error");
          return;
        }
        const typedBlob =
          blob.type && blob.type !== "application/octet-stream"
            ? blob
            : new Blob([blob], { type: "application/pdf" });
        const url = URL.createObjectURL(typedBlob);
        blobUrlRef.current = url;
        setBlobUrl(url);
        setPhase("ready");
      } catch (e) {
        if (DEBUG) {
          console.warn("[pdf-preview] fetch or blob error", e);
        }
        if (!cancelled) setPhase("error");
      }
    })();

    return () => {
      cancelled = true;
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
        blobUrlRef.current = null;
      }
    };
  }, [evidenceId, streamUrl]);

  if (phase === "error") {
    return (
      <div className={className}>
        <PreviewUnavailable streamUrl={streamUrl} detail="The preview could not be loaded in-page. Opening the file may still work in your browser." />
      </div>
    );
  }

  if (phase === "loading" || !blobUrl) {
    return (
      <div
        className={`flex min-h-[min(70vh,560px)] items-center justify-center rounded-lg border border-border bg-white ${className ?? ""}`}
        aria-busy="true"
      >
        <InvestigationLoadingIndicator inline label="Loading PDF preview…" className="justify-center" />
      </div>
    );
  }

  return (
    <div className={`space-y-3 ${className ?? ""}`}>
      <p className="text-[10px] leading-snug text-foreground/90">
        Loaded through a same-origin preview URL (not text extraction). If the frame below stays blank, use{" "}
        <span className="font-medium text-foreground">Open file</span>.
      </p>
      <div className="overflow-hidden rounded border border-border bg-white shadow-sm">
        <iframe
          src={blobUrl}
          title={`PDF preview: ${filename}`}
          className="block h-[min(75vh,780px)] w-full bg-neutral-100"
          onError={() => {
            if (DEBUG) console.warn("[pdf-preview] iframe error event", { evidenceId });
          }}
        />
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          asChild
          type="button"
          variant="secondary"
          size="sm"
          className="border-sky-600 bg-white text-foreground shadow-sm hover:bg-sky-50"
        >
          <a href={streamUrl} target="_blank" rel="noopener noreferrer">
            Open file
          </a>
        </Button>
      </div>
    </div>
  );
}
