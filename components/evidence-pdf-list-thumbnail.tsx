"use client";

import { useEffect, useRef, useState } from "react";
import { PDFJS_DIST_VERSION } from "@/lib/pdfjs-version";

/**
 * Renders page 1 of a PDF into a small JPEG data URL (list views only).
 * Loads pdfjs only when `url` is set and the component stays mounted.
 */
export function EvidencePdfListThumbnail({
  url,
  width,
  height,
  className,
}: {
  url: string;
  width: number;
  height: number;
  className?: string;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const cancelledRef = useRef(false);

  useEffect(() => {
    cancelledRef.current = false;
    setDataUrl(null);
    setFailed(false);
    if (!url) {
      setFailed(true);
      return;
    }

    let task: { destroy?: () => Promise<void> } | null = null;

    (async () => {
      try {
        const { getDocument, GlobalWorkerOptions } = await import("pdfjs-dist");
        GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${PDFJS_DIST_VERSION}/build/pdf.worker.mjs`;

        const loadingTask = getDocument({
          url,
          disableRange: true,
          disableStream: true,
        });
        task = loadingTask;
        const pdf = await loadingTask.promise;
        if (cancelledRef.current) {
          await pdf.destroy().catch(() => {});
          return;
        }
        const page = await pdf.getPage(1);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = Math.min(width / baseViewport.width, height / baseViewport.height, 1.2);
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await page.render({ canvas, viewport }).promise;
        await page.cleanup();
        await pdf.destroy().catch(() => {});
        if (cancelledRef.current) return;
        setDataUrl(canvas.toDataURL("image/jpeg", 0.82));
      } catch {
        if (!cancelledRef.current) setFailed(true);
      }
    })();

    return () => {
      cancelledRef.current = true;
      if (task && typeof task.destroy === "function") {
        void task.destroy();
      }
    };
  }, [url, width, height]);

  if (failed || !dataUrl) {
    return (
      <div
        className={`flex items-center justify-center rounded border border-border bg-muted text-[9px] font-bold leading-none text-foreground ${className ?? ""}`}
        style={{ width, height }}
        title={failed ? "PDF thumbnail unavailable" : "Loading PDF preview…"}
      >
        PDF
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- data URL from canvas
    <img
      src={dataUrl}
      alt=""
      width={width}
      height={height}
      className={`rounded border border-border object-cover bg-white ${className ?? ""}`}
      loading="lazy"
      draggable={false}
    />
  );
}
