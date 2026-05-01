"use client";

import Link from "next/link";
import { useCallback, useId } from "react";
import { latToYPercent, lonToXPercent } from "@/lib/geo-project";
import type { LocationMapPinRow } from "@/types";

type Props = {
  pins: LocationMapPinRow[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
};

/** Static equirectangular “world” panel with graticule; pins are clickable overlays (no live tile engine). */
export function EvidenceLocationStaticMap({ pins, selectedId, onSelect }: Props) {
  const baseId = useId();
  const lines = (
    <>
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((lon) => (
        <line
          key={`v-${lon}`}
          x1={`${lonToXPercent(lon)}%`}
          y1="0%"
          x2={`${lonToXPercent(lon)}%`}
          y2="100%"
          className="stroke-slate-600/35"
          strokeWidth={0.35}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {[-60, -30, 0, 30, 60].map((lat) => (
        <line
          key={`h-${lat}`}
          x1="0%"
          y1={`${latToYPercent(lat)}%`}
          x2="100%"
          y2={`${latToYPercent(lat)}%`}
          className="stroke-slate-600/35"
          strokeWidth={0.35}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </>
  );

  const onKeyNav = useCallback(
    (e: React.KeyboardEvent, id: string) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect(selectedId === id ? null : id);
      }
    },
    [onSelect, selectedId],
  );

  return (
    <div className="space-y-3">
      <div
        className="relative w-full overflow-hidden rounded-xl border border-[#1e2d42] bg-[#0a1524] shadow-inner"
        style={{ aspectRatio: "2 / 1" }}
        role="img"
        aria-label="Static world map with location pins"
      >
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={`${baseId}-ocean`} x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#0c1828" />
              <stop offset="100%" stopColor="#0f1f35" />
            </linearGradient>
          </defs>
          <rect width="100" height="50" fill={`url(#${baseId}-ocean)`} />
          {lines}
        </svg>

        {pins.map((p) => {
          const left = lonToXPercent(p.longitude);
          const top = latToYPercent(p.latitude);
          const active = selectedId === p.id;
          return (
            <button
              key={p.id}
              type="button"
              title={p.title}
              className={`absolute -translate-x-1/2 -translate-y-full focus:outline-none ${active ? "z-20" : "z-10"}`}
              style={{ left: `${left}%`, top: `${top}%` }}
              onClick={() => onSelect(active ? null : p.id)}
              onKeyDown={(e) => onKeyNav(e, p.id)}
              aria-label={`Pin: ${p.title}`}
              aria-pressed={active}
            >
              <span
                className={`flex h-4 w-4 items-center justify-center rounded-full border-2 border-white shadow-md transition-transform hover:scale-110 focus-visible:scale-110 focus-visible:ring-2 focus-visible:ring-sky-400/80 ${
                  active ? "bg-sky-500 ring-2 ring-sky-300/60" : "bg-red-500"
                }`}
              >
                <span className="sr-only">{p.title}</span>
              </span>
            </button>
          );
        })}
      </div>

      {selectedId ? (
        <div className="rounded-lg border border-border bg-card px-3 py-2.5 text-sm shadow-sm">
          {(() => {
            const p = pins.find((x) => x.id === selectedId);
            if (!p) return null;
            return (
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="font-semibold leading-snug text-foreground">{p.title}</p>
                  {p.shortAlias ? (
                    <p className="text-xs text-muted-foreground">
                      Alias: <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">{p.shortAlias}</code>
                    </p>
                  ) : null}
                  {p.caseTitle ? (
                    <p className="text-xs text-muted-foreground">
                      Case: <span className="text-foreground">{p.caseTitle}</span>
                    </p>
                  ) : null}
                  <p className="text-[11px] text-muted-foreground">
                    {p.latitude.toFixed(5)}, {p.longitude.toFixed(5)}
                  </p>
                </div>
                <Link
                  href={p.href}
                  className="inline-flex shrink-0 items-center rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {p.linkLabel ?? "Open evidence"}
                </Link>
              </div>
            );
          })()}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Select a pin for details, or open evidence from the link.</p>
      )}
    </div>
  );
}
