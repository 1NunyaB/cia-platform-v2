"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import type { EvidenceCompareInsight } from "@/types/evidence-compare-insight";
import { ProtectedEvidenceView } from "@/components/protected-evidence-view";
import { InvestigationLoadingIndicator } from "@/components/investigation-loading-indicator";

type FileUrlPayload = { url: string; mimeType: string | null; filename: string; viewerLabel: string };

function EpistemicBadge({ value }: { value: string }) {
  return (
    <span className="ml-1.5 rounded border border-border bg-panel px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
      {value}
    </span>
  );
}

export function EvidenceCompareWorkspace({ evidenceIdA, evidenceIdB }: { evidenceIdA: string; evidenceIdB: string }) {
  const [left, setLeft] = useState<FileUrlPayload | null>(null);
  const [right, setRight] = useState<FileUrlPayload | null>(null);
  const [errLeft, setErrLeft] = useState<string | null>(null);
  const [errRight, setErrRight] = useState<string | null>(null);
  const [mode, setMode] = useState<"side" | "overlay">("side");
  const [overlayOpacity, setOverlayOpacity] = useState(50);
  const [insight, setInsight] = useState<EvidenceCompareInsight | null>(null);
  const [insightErr, setInsightErr] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [dims, setDims] = useState<{
    lw?: number;
    lh?: number;
    rw?: number;
    rh?: number;
  }>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [ra, rb] = await Promise.all([
          fetch(`/api/evidence/${evidenceIdA}/file-url`),
          fetch(`/api/evidence/${evidenceIdB}/file-url`),
        ]);
        const ja = (await ra.json()) as FileUrlPayload & { error?: string };
        const jb = (await rb.json()) as FileUrlPayload & { error?: string };
        if (cancelled) return;
        if (!ra.ok) setErrLeft(ja.error ?? "Could not load file A");
        else setLeft(ja);
        if (!rb.ok) setErrRight(jb.error ?? "Could not load file B");
        else setRight(jb);
      } catch {
        if (!cancelled) {
          setErrLeft("Could not load file A");
          setErrRight("Could not load file B");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [evidenceIdA, evidenceIdB]);

  const leftMt = (left?.mimeType ?? "").toLowerCase();
  const rightMt = (right?.mimeType ?? "").toLowerCase();
  const bothImages = leftMt.startsWith("image/") && rightMt.startsWith("image/");
  const bothPdf = leftMt.includes("pdf") && rightMt.includes("pdf");

  const runAi = useCallback(async () => {
    setInsightLoading(true);
    setInsightErr(null);
    try {
      const res = await fetch("/api/evidence/compare-insight", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leftId: evidenceIdA,
          rightId: evidenceIdB,
          leftWidth: dims.lw,
          leftHeight: dims.lh,
          rightWidth: dims.rw,
          rightHeight: dims.rh,
        }),
      });
      const data = (await res.json()) as { insight?: EvidenceCompareInsight; error?: string };
      if (!res.ok) {
        setInsightErr(data.error ?? "AI assist unavailable");
        setInsight(null);
        return;
      }
      setInsight(data.insight ?? null);
    } catch {
      setInsightErr("AI assist unavailable");
      setInsight(null);
    } finally {
      setInsightLoading(false);
    }
  }, [evidenceIdA, evidenceIdB, dims.lw, dims.lh, dims.rw, dims.rh]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <Link href="/evidence" className="text-foreground hover:underline">
            ← Evidence library
          </Link>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant={mode === "side" ? "default" : "outline"} onClick={() => setMode("side")}>
            Side-by-side
          </Button>
          <Button
            type="button"
            size="sm"
            variant={mode === "overlay" ? "default" : "outline"}
            onClick={() => setMode("overlay")}
            disabled={!bothImages}
            title={!bothImages ? "Overlay needs two image files" : undefined}
          >
            Overlay
          </Button>
        </div>
      </div>

      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground">Comparison workspace</CardTitle>
          <CardDescription className="text-foreground/90">
            Two items open together. Overlay mode layers images and lets you adjust transparency. AI output is labeled as
            approximate or inferred — not verified forensic measurement.
          </CardDescription>
          <p className="text-[11px] text-foreground/90">
            In-app review only. Download/export actions are not provided; watermarking and blocked copy/context actions are
            deterrents only.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {mode === "side" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <PreviewPane
                label="A"
                payload={left}
                error={errLeft}
                onImageLoad={(w, h) => setDims((d) => ({ ...d, lw: w, lh: h }))}
              />
              <PreviewPane
                label="B"
                payload={right}
                error={errRight}
                onImageLoad={(w, h) => setDims((d) => ({ ...d, rw: w, rh: h }))}
              />
            </div>
          ) : bothImages && left && right ? (
            <div className="space-y-3">
              <ProtectedEvidenceView
                viewerLabel={left.viewerLabel}
                className="relative mx-auto flex min-h-[min(70vh,560px)] max-w-full items-center justify-center rounded-lg border border-document-border bg-document p-4"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={left.url}
                  alt={left.filename}
                  draggable={false}
                  className="max-h-[min(70vh,560px)] w-auto max-w-full object-contain"
                  onLoad={(e) =>
                    setDims((d) => ({
                      ...d,
                      lw: e.currentTarget.naturalWidth,
                      lh: e.currentTarget.naturalHeight,
                    }))
                  }
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={right.url}
                  alt={right.filename}
                  draggable={false}
                  className="absolute max-h-[min(70vh,560px)] w-auto max-w-full object-contain"
                  style={{ opacity: overlayOpacity / 100 }}
                  onLoad={(e) =>
                    setDims((d) => ({
                      ...d,
                      rw: e.currentTarget.naturalWidth,
                      rh: e.currentTarget.naturalHeight,
                    }))
                  }
                />
              </ProtectedEvidenceView>
              <div className="flex flex-wrap items-center gap-3">
                <Label htmlFor="overlay-op" className="text-foreground">
                  Top layer visibility
                </Label>
                <input
                  id="overlay-op"
                  type="range"
                  min={5}
                  max={100}
                  value={overlayOpacity}
                  onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                  className="w-48 accent-sky-600"
                />
                <span className="text-xs font-medium text-foreground">{overlayOpacity}%</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-foreground">Switch to side-by-side for PDFs or mixed types.</p>
          )}

          {bothPdf && left && right && mode === "side" ? (
            <p className="text-xs text-muted-foreground">
              PDFs are shown side-by-side in embedded viewers. Overlay is not available for PDFs in this workspace.
            </p>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            <Button type="button" size="sm" variant="secondary" disabled={insightLoading} onClick={() => void runAi()}>
              {insightLoading ? <InvestigationLoadingIndicator inline label="Requesting AI..." /> : "AI comparison assist"}
            </Button>
            <span className="text-xs text-foreground/90">
              Uses filenames, MIME types, and on-screen image dimensions when available.
            </span>
          </div>

          {insightErr ? (
            <p className="text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">{insightErr}</p>
          ) : null}

          {insight ? (
            <div className="space-y-3 rounded-md border border-sky-200 bg-sky-50/90 p-4 text-sm text-foreground">
              <p className="font-semibold text-foreground">AI comparison notes</p>
              <div>
                <span className="font-medium">Size / scale</span>
                <EpistemicBadge value={insight.size_ratio.epistemic} />
                <p className="mt-1 leading-relaxed">{insight.size_ratio.summary}</p>
              </div>
              <div>
                <span className="font-medium">Alignment ideas</span>
                <EpistemicBadge value={insight.alignment.epistemic} />
                <ul className="mt-1 list-disc pl-5 space-y-1">
                  {insight.alignment.suggestions.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <span className="font-medium">Scaling guidance</span>
                <EpistemicBadge value={insight.scaling_guidance.epistemic} />
                <p className="mt-1 leading-relaxed">{insight.scaling_guidance.text}</p>
              </div>
              <div>
                <span className="font-medium">Likely similarities</span>
                <EpistemicBadge value={insight.similarities.epistemic} />
                <p className="mt-1 leading-relaxed">{insight.similarities.text}</p>
              </div>
              <div>
                <span className="font-medium">Likely differences</span>
                <EpistemicBadge value={insight.differences.epistemic} />
                <p className="mt-1 leading-relaxed">{insight.differences.text}</p>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function PreviewPane({
  label,
  payload,
  error,
  onImageLoad,
}: {
  label: string;
  payload: FileUrlPayload | null;
  error: string | null;
  onImageLoad: (w: number, h: number) => void;
}) {
  if (error) {
    return (
      <div className="rounded-lg border border-border bg-panel p-4 text-sm text-foreground">
        <p className="font-medium">Item {label}</p>
        <p className="mt-1 text-rose-800">{error}</p>
      </div>
    );
  }
  if (!payload) {
    return (
      <div className="rounded-lg border border-border bg-panel p-8 text-center text-sm text-muted-foreground">
        <InvestigationLoadingIndicator inline label={`Scanning ${label}...`} className="justify-center" />
      </div>
    );
  }
  const mt = (payload.mimeType ?? "").toLowerCase();
  if (mt.startsWith("image/")) {
    return (
      <ProtectedEvidenceView viewerLabel={payload.viewerLabel} className="rounded-lg border border-document-border bg-document p-3">
        <p className="mb-2 text-xs font-semibold uppercase text-foreground">Item {label}</p>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={payload.url}
          alt={payload.filename}
          draggable={false}
          className="mx-auto max-h-[min(55vh,480px)] w-auto max-w-full rounded border border-border bg-white object-contain"
          onLoad={(e) => onImageLoad(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight)}
        />
      </ProtectedEvidenceView>
    );
  }
  if (mt.includes("pdf")) {
    return (
      <ProtectedEvidenceView viewerLabel={payload.viewerLabel} className="space-y-2 rounded-lg border border-document-border bg-document p-3">
        <p className="text-xs font-semibold uppercase text-foreground">Item {label}</p>
        <iframe
          title={`PDF ${label}`}
          src={payload.url}
          className="h-[min(55vh,480px)] w-full rounded border border-border bg-white"
          sandbox="allow-scripts allow-same-origin"
        />
      </ProtectedEvidenceView>
    );
  }
  return (
    <div className="rounded-lg border border-border bg-panel p-4 text-sm text-foreground">
      <p className="font-medium">Item {label}</p>
      <p className="mt-1 text-foreground/90">No inline preview for this type. The file is still stored for review.</p>
    </div>
  );
}
