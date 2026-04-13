"use client";

import { useMemo } from "react";
import type { ReactNode } from "react";

export function ProtectedEvidenceView({
  viewerLabel,
  children,
  className = "",
}: {
  viewerLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const stamp = useMemo(() => new Date().toLocaleString(), []);
  const watermarkText = `CIA PLATFORM • ${viewerLabel} • ${stamp}`;

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && ["s", "p"].includes(e.key.toLowerCase())) {
          e.preventDefault();
        }
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-10 opacity-[0.2] [mask-image:linear-gradient(to_bottom,transparent,black_8%,black_92%,transparent)]"
        aria-hidden
      >
        <div className="grid h-full w-full grid-cols-2 gap-8 p-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="rotate-[-20deg] text-[11px] font-semibold tracking-wide text-sky-900/80">
              {watermarkText}
            </span>
          ))}
        </div>
      </div>
      {children}
    </div>
  );
}

