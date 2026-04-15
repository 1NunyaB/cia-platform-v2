"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ZoomIn, ZoomOut } from "lucide-react";
import { ProtectedEvidenceView } from "@/components/protected-evidence-view";
import { InvestigationLoadingIndicator } from "@/components/investigation-loading-indicator";
import { resolveEvidencePreviewKind } from "@/lib/evidence-preview-kind";
import { EvidencePdfPageViewer } from "@/components/evidence-pdf-page-viewer";
import { Button } from "@/components/ui/button";

type FileUrlPayload = {
  url: string;
  streamUrl?: string;
  mimeType: string | null;
  filename: string;
  viewerLabel: string;
};

const PREVIEW_UNAVAILABLE = "Preview unavailable for this file type.";

function PreviewOpenFallback({
  openHref,
  title = "Preview unavailable. Click to open file.",
  detail,
}: {
  openHref: string;
  title?: string;
  detail?: string | null;
}) {
  return (
    <div
      id="evidence-file-preview"
      className="scroll-mt-4 rounded-lg border-2 border-amber-700/40 bg-amber-50 px-4 py-4 text-sm text-foreground"
      role="status"
    >
      <p className="font-semibold text-foreground">{title}</p>
      {detail ? <p className="mt-1 text-sm text-foreground/95">{detail}</p> : null}
      <div className="mt-3">
        <Button
          asChild
          type="button"
          variant="secondary"
          size="sm"
          className="border-sky-600 bg-white text-foreground shadow-sm hover:bg-sky-50"
        >
          <a href={openHref} target="_blank" rel="noopener noreferrer">
            Open file
          </a>
        </Button>
      </div>
    </div>
  );
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

function ZoomToolbar({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-sky-300/90 bg-white px-2 py-1.5 shadow-sm">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground">View</span>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-7 gap-1 border-sky-400 bg-sky-50 px-2 text-xs text-foreground"
        onClick={onZoomOut}
        disabled={zoom <= ZOOM_MIN + 0.01}
        aria-label="Zoom out"
      >
        <ZoomOut className="h-3.5 w-3.5" aria-hidden />
        Out
      </Button>
      <Button type="button" size="sm" variant="secondary" className="h-7 border-border px-2 text-xs" onClick={onReset}>
        {Math.round(zoom * 100)}%
      </Button>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-7 gap-1 border-sky-400 bg-sky-50 px-2 text-xs text-foreground"
        onClick={onZoomIn}
        disabled={zoom >= ZOOM_MAX - 0.01}
        aria-label="Zoom in"
      >
        <ZoomIn className="h-3.5 w-3.5" aria-hidden />
        In
      </Button>
      <span className="text-[10px] text-foreground/80">Scroll the frame to pan when zoomed.</span>
    </div>
  );
}

/**
 * Loads file-url, shows image / PDF / video inline with zoom and clear fallbacks (no text extraction).
 */
export function EvidenceFilePreview({
  evidenceId,
  caseId = null,
}: {
  evidenceId: string;
  /** Case context for stack picker on PDF page actions; omit on library-only views. */
  caseId?: string | null;
}) {
  const [payload, setPayload] = useState<FileUrlPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [textPreviewError, setTextPreviewError] = useState<string | null>(null);

  const bumpZoom = useCallback((delta: number) => {
    setZoom((z) => {
      const n = Math.round((z + delta) * 100) / 100;
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, n));
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/evidence/${evidenceId}/file-url`, { credentials: "include" });
        const data = (await res.json()) as FileUrlPayload & { error?: string };
        if (!res.ok) {
          if (process.env.NODE_ENV === "development") {
            console.warn("[evidence-file-preview] file-url failed", evidenceId, res.status, data?.error);
          }
          if (!cancelled) setError(data.error ?? "Could not load preview metadata.");
          return;
        }
        if (process.env.NODE_ENV === "development") {
          console.info("[evidence-file-preview] file-url ok", {
            evidenceId,
            streamUrl: data.streamUrl ?? `/api/evidence/${evidenceId}/file`,
            mimeType: data.mimeType,
          });
        }
        if (!cancelled) setPayload(data);
      } catch (e) {
        if (process.env.NODE_ENV === "development") {
          console.warn("[evidence-file-preview] file-url network error", evidenceId, e);
        }
        if (!cancelled) setError("Could not load preview. Try Open file.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [evidenceId]);

  const kind = useMemo(
    () => resolveEvidencePreviewKind(payload?.mimeType ?? null, payload?.filename ?? null),
    [payload?.mimeType, payload?.filename],
  );

  const streamSrc = payload ? payload.streamUrl ?? `/api/evidence/${evidenceId}/file` : null;
  const isTextLike =
    !!payload?.mimeType &&
    (payload.mimeType.startsWith("text/") ||
      payload.mimeType.includes("json") ||
      payload.mimeType.includes("xml") ||
      payload.mimeType.includes("csv"));

  useEffect(() => {
    let cancelled = false;
    setTextPreview(null);
    setTextPreviewError(null);
    if (!streamSrc || !isTextLike) return;
    (async () => {
      try {
        const res = await fetch(streamSrc, { credentials: "include" });
        if (!res.ok) {
          if (!cancelled) setTextPreviewError("Could not load extracted content preview.");
          return;
        }
        const text = await res.text();
        if (!cancelled) setTextPreview(text.trim() ? text : "No readable text content was found.");
      } catch {
        if (!cancelled) setTextPreviewError("Could not load extracted content preview.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [streamSrc, isTextLike]);

  const zoomWrap = (inner: React.ReactNode) => (
    <div id="evidence-file-preview" className="scroll-mt-4 space-y-0">
      <ZoomToolbar
        zoom={zoom}
        onZoomIn={() => bumpZoom(ZOOM_STEP)}
        onZoomOut={() => bumpZoom(-ZOOM_STEP)}
        onReset={() => setZoom(1)}
      />
      <div className="max-h-[min(88vh,920px)] overflow-auto rounded-lg border-2 border-sky-300/80 bg-sky-50/30 p-2 shadow-inner">
        <div
          className="inline-block min-w-full origin-top-left transition-transform duration-150 ease-out"
          style={{ transform: `scale(${zoom})` }}
        >
          {inner}
        </div>
      </div>
    </div>
  );

  if (error) {
    return (
      <PreviewOpenFallback
        openHref={`/api/evidence/${evidenceId}/file`}
        detail={error}
        title="Preview unavailable. Click to open file."
      />
    );
  }

  if (!payload) {
    return (
      <div
        id="evidence-file-preview"
        className="scroll-mt-4 rounded-lg border border-document-border bg-document px-4 py-6 text-center text-sm text-muted-foreground"
      >
        <InvestigationLoadingIndicator inline label="Loading file…" className="justify-center" />
      </div>
    );
  }

  if (!streamSrc) {
    return (
      <PreviewOpenFallback openHref={`/api/evidence/${evidenceId}/file`} detail="Could not resolve preview URL." />
    );
  }

  if (kind === "image") {
    return zoomWrap(
      <ProtectedEvidenceView viewerLabel={payload.viewerLabel} className="rounded-lg border border-document-border bg-document p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">Image</p>
        <p className="mb-2 text-[10px] leading-snug text-foreground">
          Same-origin stream (not a public link). Use zoom controls above; scroll to pan when zoomed.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element -- same-origin /api/evidence/.../file */}
        <img
          src={streamSrc}
          alt={payload.filename}
          draggable={false}
          loading="eager"
          decoding="async"
          className="max-w-none rounded border border-border bg-white shadow-sm"
          style={{ maxHeight: "none" }}
        />
      </ProtectedEvidenceView>,
    );
  }

  if (kind === "pdf") {
    return zoomWrap(
      <ProtectedEvidenceView
        viewerLabel={payload.viewerLabel}
        className="space-y-2 rounded-lg border border-document-border bg-document p-3"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground">PDF</p>
        <p className="text-[10px] leading-snug text-foreground">
          Embedded via a same-origin viewer. Use zoom above for a closer look; scroll inside the frame to move around.
        </p>
        <EvidencePdfPageViewer evidenceId={evidenceId} streamUrl={streamSrc} filename={payload.filename} caseId={caseId} />
      </ProtectedEvidenceView>,
    );
  }

  if (kind === "video") {
    return zoomWrap(
      <ProtectedEvidenceView viewerLabel={payload.viewerLabel} className="rounded-lg border border-document-border bg-document p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">Video</p>
        <p className="mb-2 text-[10px] leading-snug text-foreground">
          Same-origin stream with Range support for seeking. Zoom scales the player area.
        </p>
        <video
          key={evidenceId}
          controls
          playsInline
          preload="metadata"
          src={streamSrc}
          className="max-w-full rounded border border-border bg-black"
        >
          <a href={streamSrc} target="_blank" rel="noopener noreferrer" className="text-sm text-sky-200 underline">
            Open file
          </a>
        </video>
      </ProtectedEvidenceView>,
    );
  }

  if (kind === "audio") {
    return (
      <div id="evidence-file-preview" className="scroll-mt-4 space-y-2">
        <ProtectedEvidenceView viewerLabel={payload.viewerLabel} className="rounded-lg border border-document-border bg-document p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">Audio</p>
          <audio key={evidenceId} controls preload="metadata" className="w-full" src={streamSrc}>
            <a href={streamSrc} target="_blank" rel="noopener noreferrer" className="text-sm underline">
              Open file
            </a>
          </audio>
        </ProtectedEvidenceView>
      </div>
    );
  }

  if (isTextLike) {
    return (
      <div id="evidence-file-preview" className="scroll-mt-4 space-y-2">
        <ProtectedEvidenceView viewerLabel={payload.viewerLabel} className="rounded-lg border border-document-border bg-document p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">Displaying extracted content</p>
          <div className="max-h-[min(68vh,760px)] overflow-auto rounded border border-border bg-white/90 p-3">
            {textPreviewError ? (
              <p className="text-sm text-destructive">{textPreviewError}</p>
            ) : textPreview == null ? (
              <p className="text-sm text-muted-foreground">Loading extracted content…</p>
            ) : (
              <pre className="whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground">{textPreview}</pre>
            )}
          </div>
        </ProtectedEvidenceView>
      </div>
    );
  }

  return (
    <PreviewOpenFallback
      openHref={streamSrc}
      detail={`Displaying extracted content is not available for this format (${payload.mimeType ?? "unknown"}). The file is still stored.`}
      title="Preview unavailable. Click to open file."
    />
  );
}
