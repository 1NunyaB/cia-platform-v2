"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { EvidenceLocationStaticMap } from "@/components/evidence-location-static-map";
import type { LocationMapPinRow } from "@/types";

export default function EvidenceMapPage() {
  const [pins, setPins] = useState<LocationMapPinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [unauthorized, setUnauthorized] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const res = await fetch("/api/evidence/location-map");
    if (res.status === 401) {
      setUnauthorized(true);
      setPins([]);
      setLoading(false);
      return;
    }
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setLoadError(typeof data.error === "string" ? data.error : "Could not load map");
      setPins([]);
      setLoading(false);
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { pins?: LocationMapPinRow[] };
    setPins(Array.isArray(data.pins) ? data.pins : []);
    setUnauthorized(false);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div
      className="mx-auto max-w-5xl space-y-4 px-5 font-sans pb-8"
      style={{ backgroundColor: "transparent", color: "#e2e8f0" }}
    >
      <div>
        <h1 className="text-2xl font-bold text-white">Evidence map</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed" style={{ color: "#64748b" }}>
          Static world view of <strong className="font-semibold text-slate-300">Location</strong>-folder evidence with
          saved coordinates, and <strong className="font-semibold text-slate-300">incident</strong> locations when city
          and state are saved and coordinates can be resolved. Evidence pins come from the evidence detail page; incident
          pins sync when you save case details.
        </p>
      </div>

      {unauthorized ? (
        <p className="text-sm text-slate-400">
          <Link href="/login" className="text-sky-400 underline-offset-2 hover:underline">
            Sign in
          </Link>{" "}
          to view your location pins.
        </p>
      ) : null}

      {loadError ? <p className="text-sm text-rose-400">{loadError}</p> : null}

      {!unauthorized && !loadError ? (
        <>
          {loading ? (
            <p className="text-sm text-slate-500">Loading map…</p>
          ) : pins.length === 0 ? (
            <div
              className="rounded-xl border border-[#1e2d42] px-4 py-6 text-sm"
              style={{ backgroundColor: "#141e2e", color: "#94a3b8" }}
            >
              <p className="font-medium text-slate-200">No pins yet</p>
              <p className="mt-2 text-xs leading-relaxed">
                Add coordinates on location evidence, or save an incident with city and state on a case — pins appear
                only when latitude and longitude are available (no approximate placement for unknown cities yet).
              </p>
              <Link
                href="/evidence"
                className="mt-3 inline-flex text-xs font-semibold text-sky-400 underline-offset-2 hover:underline"
              >
                Back to Evidence Library
              </Link>
            </div>
          ) : (
            <EvidenceLocationStaticMap pins={pins} selectedId={selectedId} onSelect={setSelectedId} />
          )}
        </>
      ) : null}
    </div>
  );
}
