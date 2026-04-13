"use client";

import { useEffect, useState } from "react";
import { ProtectedEvidenceView } from "@/components/protected-evidence-view";
import { InvestigationLoadingIndicator } from "@/components/investigation-loading-indicator";

type FileUrlPayload = { url: string; mimeType: string | null; filename: string; viewerLabel: string };

/**
 * Loads a short-lived signed URL and shows an image, PDF iframe, or a clear fallback.
 * Visually separated from metadata (pale blue panel).
 */
export function EvidenceFilePreview({ evidenceId }: { evidenceId: string }) {
  const [payload, setPayload] = useState<FileUrlPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/evidence/${evidenceId}/file-url`);
        const data = (await res.json()) as FileUrlPayload & { error?: string };
        if (!res.ok) {
          if (!cancelled) setError(data.error ?? "Could not load file preview.");
          return;
        }
        if (!cancelled) setPayload(data);
      } catch {
        if (!cancelled) setError("Could not load file preview.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [evidenceId]);

  if (error) {
    return (
      <div className="rounded-lg border border-document-border bg-document px-4 py-6 text-sm text-foreground">
        <p className="font-medium text-foreground">Preview unavailable</p>
        <p className="mt-1 text-foreground/90">{error}</p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="rounded-lg border border-document-border bg-document px-4 py-8 text-center text-sm text-muted-foreground">
        <InvestigationLoadingIndicator inline label="Inspecting evidence..." className="justify-center" />
      </div>
    );
  }

  const mt = (payload.mimeType ?? "").toLowerCase();
  if (mt.startsWith("image/")) {
    return (
      <ProtectedEvidenceView viewerLabel={payload.viewerLabel} className="rounded-lg border border-document-border bg-document p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground">File preview</p>
        <p className="mb-2 text-[10px] leading-snug text-foreground">
          In-app viewing only. Download/export actions are not provided. This watermark and interaction blocking are
          deterrents only and cannot fully prevent screenshots or external capture.
        </p>
        {/* eslint-disable-next-line @next/next/no-img-element -- signed Supabase URL */}
        <img
          src={payload.url}
          alt={payload.filename}
          draggable={false}
          className="mx-auto max-h-[min(70vh,640px)] w-auto max-w-full rounded border border-border bg-white shadow-sm"
        />
      </ProtectedEvidenceView>
    );
  }

  if (mt.includes("pdf")) {
    return (
      <ProtectedEvidenceView
        viewerLabel={payload.viewerLabel}
        className="space-y-2 rounded-lg border border-document-border bg-document p-4"
      >
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground">File preview</p>
        <p className="text-[10px] leading-snug text-foreground">
          In-app viewing only. Download/export actions are not provided. Capture outside the browser cannot be fully
          blocked.
        </p>
        <iframe
          title="PDF preview"
          src={payload.url}
          className="w-full min-h-[480px] rounded border border-border bg-white"
          sandbox="allow-scripts allow-same-origin"
        />
      </ProtectedEvidenceView>
    );
  }

  return (
    <div className="rounded-lg border border-document-border bg-document px-4 py-6 text-sm text-foreground">
      <p className="font-medium text-foreground">No inline preview for this file type</p>
      <p className="mt-1 text-foreground/90">
        This format is not embedded here. The file remains stored for extraction and analysis.
      </p>
    </div>
  );
}
