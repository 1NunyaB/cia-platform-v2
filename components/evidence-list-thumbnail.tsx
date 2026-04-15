"use client";

import { useEffect, useRef, useState } from "react";
import { FileQuestion, FileText, Film, Music } from "lucide-react";
import { EvidencePdfListThumbnail } from "@/components/evidence-pdf-list-thumbnail";
import { resolveEvidencePreviewKind, type EvidencePreviewKind } from "@/lib/evidence-preview-kind";
import { cn } from "@/lib/utils";

const SIZES = {
  /** Default list rows (case index, dashboard, etc.). */
  compact: { px: 52, boxClass: "h-[3.25rem] w-[3.25rem]", iconSm: "h-5 w-5", iconMd: "h-4 w-4", pdfText: "text-[10px]" },
  /** Evidence Library — larger for quick visual ID. */
  library: { px: 88, boxClass: "h-[5.5rem] w-[5.5rem]", iconSm: "h-6 w-6", iconMd: "h-5 w-5", pdfText: "text-[11px]" },
} as const;

function Placeholder({
  kind,
  title,
  sizeKey,
}: {
  kind: EvidencePreviewKind | "loading";
  title: string;
  sizeKey: keyof typeof SIZES;
}) {
  const s = SIZES[sizeKey];
  const icon =
    kind === "audio" ? (
      <Music className={cn(s.iconSm, "text-foreground")} aria-hidden />
    ) : kind === "video" ? (
      <Film className={cn(s.iconSm, "text-foreground")} aria-hidden />
    ) : kind === "pdf" ? (
      <span className={cn(s.pdfText, "font-bold text-foreground")}>PDF</span>
    ) : kind === "loading" ? (
      <span className="text-[10px] font-medium text-muted-foreground">…</span>
    ) : (
      <FileText className={cn(s.iconSm, "text-foreground")} aria-hidden />
    );
  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded border border-border bg-muted",
        s.boxClass,
      )}
      title={title}
    >
      {icon}
    </div>
  );
}

/**
 * Compact list thumbnail: lazy-loads when scrolled near viewport; images use `<img>`;
 * PDFs render first page via pdf.js; videos use a muted metadata preview.
 */
export function EvidenceListThumbnail({
  evidenceId,
  mimeType,
  filenameHint,
  size = "compact",
}: {
  evidenceId: string;
  mimeType: string | null;
  /** Used when `mimeType` is null (extension-based guess). */
  filenameHint?: string | null;
  /** `library` uses a larger preview for the Evidence Library list. */
  size?: keyof typeof SIZES;
}) {
  const kind = resolveEvidencePreviewKind(mimeType, filenameHint);
  const rootRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e?.isIntersecting) setShouldLoad(true);
      },
      { rootMargin: "120px", threshold: 0.01 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={rootRef} className="shrink-0" aria-hidden={kind === "none"}>
      {shouldLoad ? (
        <EvidenceListThumbnailLoaded evidenceId={evidenceId} kind={kind} size={size} />
      ) : (
        <Placeholder kind="loading" title="Preview" sizeKey={size} />
      )}
    </div>
  );
}

function EvidenceListThumbnailLoaded({
  evidenceId,
  kind,
  size,
}: {
  evidenceId: string;
  kind: EvidencePreviewKind;
  size: keyof typeof SIZES;
}) {
  const s = SIZES[size];
  const W = s.px;
  const H = s.px;
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (kind === "none" || kind === "audio") return;
      try {
        const res = await fetch(`/api/evidence/${evidenceId}/file-url`, { credentials: "include" });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          if (!cancelled) setError(true);
          return;
        }
        if (!cancelled) setUrl(data.url);
      } catch {
        if (!cancelled) setError(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [evidenceId, kind]);

  if (kind === "audio") {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded border border-border bg-muted",
          s.boxClass,
        )}
        title="Audio file"
      >
        <Music className={cn(s.iconSm, "text-foreground")} aria-hidden />
      </div>
    );
  }

  if (kind === "none") {
    return (
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded border border-dashed border-border bg-panel",
          s.boxClass,
        )}
        title="No thumbnail for this type"
      >
        <FileQuestion className={cn(s.iconSm, "text-muted-foreground")} aria-hidden />
      </div>
    );
  }

  if (error || !url) {
    return (
      <Placeholder
        kind={kind}
        title={error ? "Preview unavailable" : "Loading preview…"}
        sizeKey={size}
      />
    );
  }

  if (kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- signed URL
      <img
        src={url}
        alt=""
        width={W}
        height={H}
        className={cn(
          "shrink-0 rounded border border-border object-cover bg-white",
          s.boxClass,
        )}
        loading="lazy"
        draggable={false}
      />
    );
  }

  if (kind === "pdf") {
    return <EvidencePdfListThumbnail url={url} width={W} height={H} />;
  }

  if (kind === "video") {
    return (
      <div
        className={cn("relative shrink-0 overflow-hidden rounded border border-border bg-black", s.boxClass)}
      >
        <video
          src={`${url}#t=0.001`}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
          aria-hidden
        />
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/25">
          <Film className={cn(s.iconMd, "text-white drop-shadow")} aria-hidden />
        </span>
      </div>
    );
  }

  return <Placeholder kind="none" title="Preview" sizeKey={size} />;
}
