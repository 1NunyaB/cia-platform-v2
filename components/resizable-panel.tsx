"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const STORAGE_KEY = "panel-height";
const DEFAULT_HEIGHT = 400;
const MIN_HEIGHT = 200;

export default function ResizablePanel({ children }: { children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const parsed = Number.parseInt(saved, 10);
      if (!Number.isNaN(parsed)) {
        setHeight(parsed);
      }
    } catch {
      /* ignore localStorage read errors */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(height));
    } catch {
      /* ignore localStorage write errors */
    }
  }, [height]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return;

      const top = panelRef.current.getBoundingClientRect().top;
      const newHeight = e.clientY - top;
      const maxHeight = window.innerHeight * 0.9;

      if (newHeight > MIN_HEIGHT && newHeight < maxHeight) {
        setHeight(newHeight);
      }
    };

    const stopResizing = () => setIsResizing(false);

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", stopResizing);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [isResizing]);

  return (
    <div
      ref={panelRef}
      style={{ height }}
      className="relative overflow-hidden rounded-lg border bg-white"
    >
      <div className="h-full overflow-auto p-3">{children}</div>

      <div
        onMouseDown={() => setIsResizing(true)}
        className="absolute bottom-0 left-0 h-2 w-full cursor-ns-resize bg-transparent transition hover:bg-gray-300"
      />
    </div>
  );
}
