"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { InvestigationLoadingIndicator } from "@/components/investigation-loading-indicator";

type FileUrlPayload = { url: string; mimeType: string | null; filename: string };

function scrollToFilePreview() {
  document.getElementById("evidence-file-preview")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function EvidenceRecoveryWorkflow({
  evidenceId,
  mimeType,
  integration = "standalone",
}: {
  evidenceId: string;
  mimeType: string | null;
  /** `panel`: toolbar actions + dialog only (no duplicate card chrome; use inside Evidence processing). */
  integration?: "standalone" | "panel";
}) {
  const router = useRouter();
  const [payload, setPayload] = useState<FileUrlPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<{ active: boolean; x0: number; y0: number; x1: number; y1: number } | null>(null);
  const [selNorm, setSelNorm] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const isImage = (mimeType ?? "").toLowerCase().startsWith("image/");

  const loadUrl = useCallback(async () => {
    setLoadError(null);
    const res = await fetch(`/api/evidence/${evidenceId}/file-url`);
    const data = (await res.json()) as FileUrlPayload & { error?: string };
    if (!res.ok) {
      setLoadError(data.error ?? "Could not load file.");
      return;
    }
    setPayload(data);
  }, [evidenceId]);

  useEffect(() => {
    void loadUrl();
  }, [loadUrl]);

  const onImageMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    const img = imgRef.current;
    if (!img) return;
    const r = img.getBoundingClientRect();
    const nx = (e.clientX - r.left) / r.width;
    const ny = (e.clientY - r.top) / r.height;
    dragRef.current = { active: true, x0: nx, y0: ny, x1: nx, y1: ny };
    setSelNorm({ x0: nx, y0: ny, x1: nx, y1: ny });
  };

  const onImageMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    const d = dragRef.current;
    const img = imgRef.current;
    if (!d?.active || !img) return;
    const r = img.getBoundingClientRect();
    const nx = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const ny = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    dragRef.current = { ...d, x1: nx, y1: ny };
    setSelNorm({ x0: d.x0, y0: d.y0, x1: nx, y1: ny });
  };

  const onImageMouseUp = () => {
    if (dragRef.current) dragRef.current = { ...dragRef.current, active: false };
  };

  async function uploadDerivativeFile(file: File) {
    setSaving(true);
    setSaveError(null);
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch(`/api/evidence/${evidenceId}/derivative`, { method: "POST", body: fd });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        caseId?: string | null;
        error?: string;
        duplicate?: boolean;
        message?: string;
      };
      if (data.duplicate) {
        setSaveError(data.message ?? "This file already exists as evidence.");
        return;
      }
      if (!res.ok) {
        setSaveError(data.error ?? "Could not save derivative.");
        return;
      }
      if (!data.id) {
        setSaveError("Unexpected response from server.");
        return;
      }
      const nextPath =
        data.caseId != null ? `/cases/${data.caseId}/evidence/${data.id}` : `/evidence/${data.id}`;
      setDialogOpen(false);
      router.push(nextPath);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function saveCrop() {
    const img = imgRef.current;
    const sel = selNorm;
    const pl = payload;
    if (!img || !sel || !pl?.url) return;
    let x0 = Math.min(sel.x0, sel.x1);
    let y0 = Math.min(sel.y0, sel.y1);
    let x1 = Math.max(sel.x0, sel.x1);
    let y1 = Math.max(sel.y0, sel.y1);
    if (x1 - x0 < 0.02 || y1 - y0 < 0.02) {
      setSaveError("Drag a larger crop rectangle on the image.");
      return;
    }
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    const sx = Math.floor(x0 * nw);
    const sy = Math.floor(y0 * nh);
    const sw = Math.max(1, Math.floor((x1 - x0) * nw));
    const sh = Math.max(1, Math.floor((y1 - y0) * nh));
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setSaveError("Could not prepare crop.");
      return;
    }
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    setSaveError(null);
    try {
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Empty crop"))), "image/png", 0.92);
      });
      const base = (pl.filename || "crop").replace(/\.[^.]+$/, "");
      const file = new File([blob], `${base}-crop.png`, { type: "image/png" });
      await uploadDerivativeFile(file);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Crop failed.");
    }
  }

  const cropOrUploadInput = (
    <>
      {isImage ? (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 border-border bg-white text-foreground"
          onClick={() => {
            setSaveError(null);
            setDialogOpen(true);
            void loadUrl();
          }}
        >
          Crop / edit
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 border-border bg-white text-foreground"
          onClick={() => fileInputRef.current?.click()}
        >
          Save cropped version
        </Button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void uploadDerivativeFile(f);
        }}
      />
    </>
  );

  const standaloneActionButtons = (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-8 border-border bg-white text-foreground"
        onClick={scrollToFilePreview}
      >
        Open file
      </Button>
      {cropOrUploadInput}
    </>
  );

  if (integration === "panel") {
    return (
      <>
        <div className="flex flex-wrap items-center gap-2">{cropOrUploadInput}</div>
        {loadError ? <p className="text-xs font-medium text-red-900">{loadError}</p> : null}
        {saveError ? <p className="text-xs font-medium text-red-900">{saveError}</p> : null}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>Crop region</DialogTitle>
              <DialogDescription>
                Drag on the image to select the area to save. A new evidence file is created; the original is not modified.
              </DialogDescription>
            </DialogHeader>
            {!payload?.url ? (
              <p className="text-sm text-muted-foreground">Loading image…</p>
            ) : (
              <div className="relative inline-block max-w-full">
                {/* eslint-disable-next-line @next/next/no-img-element -- signed URL */}
                <img
                  ref={imgRef}
                  src={payload.url}
                  alt={payload.filename}
                  draggable={false}
                  className="max-h-[60vh] w-auto max-w-full cursor-crosshair select-none rounded border border-border bg-white"
                  onMouseDown={onImageMouseDown}
                  onMouseMove={onImageMouseMove}
                  onMouseLeave={onImageMouseUp}
                  onMouseUp={onImageMouseUp}
                />
                {selNorm && imgRef.current ? (
                  <div
                    className="pointer-events-none absolute border-2 border-sky-600 bg-sky-500/20"
                    style={{
                      left: `${Math.min(selNorm.x0, selNorm.x1) * 100}%`,
                      top: `${Math.min(selNorm.y0, selNorm.y1) * 100}%`,
                      width: `${Math.abs(selNorm.x1 - selNorm.x0) * 100}%`,
                      height: `${Math.abs(selNorm.y1 - selNorm.y0) * 100}%`,
                    }}
                  />
                ) : null}
              </div>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={saving || !selNorm} onClick={() => void saveCrop()}>
                {saving ? <InvestigationLoadingIndicator inline label="Saving…" /> : "Save cropped version"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  return (
    <div className="rounded-md border-2 border-amber-500 bg-amber-50 px-2.5 py-2 text-sm text-amber-950">
      <p className="font-semibold text-amber-950">Manual review & recovery</p>
      <p className="mt-1 text-xs leading-snug text-amber-950/95">
        The original file stays unchanged. Saving a crop creates a new numbered copy linked to this original.
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">{standaloneActionButtons}</div>
      {loadError ? <p className="mt-1 text-xs text-red-800">{loadError}</p> : null}
      {saveError ? <p className="mt-1 text-xs text-red-800">{saveError}</p> : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Crop region</DialogTitle>
            <DialogDescription>
              Drag on the image to select the area to save. A new evidence file is created; the original is not modified.
            </DialogDescription>
          </DialogHeader>
          {!payload?.url ? (
            <p className="text-sm text-muted-foreground">Loading image…</p>
          ) : (
            <div className="relative inline-block max-w-full">
              {/* eslint-disable-next-line @next/next/no-img-element -- signed URL */}
              <img
                ref={imgRef}
                src={payload.url}
                alt={payload.filename}
                draggable={false}
                className="max-h-[60vh] w-auto max-w-full cursor-crosshair select-none rounded border border-border bg-white"
                onMouseDown={onImageMouseDown}
                onMouseMove={onImageMouseMove}
                onMouseLeave={onImageMouseUp}
                onMouseUp={onImageMouseUp}
              />
              {selNorm && imgRef.current ? (
                <div
                  className="pointer-events-none absolute border-2 border-sky-600 bg-sky-500/20"
                  style={{
                    left: `${Math.min(selNorm.x0, selNorm.x1) * 100}%`,
                    top: `${Math.min(selNorm.y0, selNorm.y1) * 100}%`,
                    width: `${Math.abs(selNorm.x1 - selNorm.x0) * 100}%`,
                    height: `${Math.abs(selNorm.y1 - selNorm.y0) * 100}%`,
                  }}
                />
              ) : null}
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving || !selNorm} onClick={() => void saveCrop()}>
              {saving ? <InvestigationLoadingIndicator inline label="Saving…" /> : "Save cropped version"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
