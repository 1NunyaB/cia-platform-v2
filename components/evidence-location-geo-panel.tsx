"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  evidenceId: string;
  initialLatitude: number | null;
  initialLongitude: number | null;
};

/** Coordinates for Location-folder evidence; appears on the static map when both are set. */
export function EvidenceLocationGeoPanel({ evidenceId, initialLatitude, initialLongitude }: Props) {
  const router = useRouter();
  const [lat, setLat] = useState(initialLatitude != null ? String(initialLatitude) : "");
  const [lng, setLng] = useState(initialLongitude != null ? String(initialLongitude) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const la = Number(lat);
    const lo = Number(lng);
    if (!Number.isFinite(la) || !Number.isFinite(lo)) {
      setError("Enter valid numbers for latitude and longitude.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/evidence/${evidenceId}/geo`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: la, longitude: lo }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(typeof data.error === "string" ? data.error : "Could not save coordinates");
      }
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-md border border-sky-800/40 bg-sky-50/90 px-3 py-2.5 text-sm text-sky-950">
      <p className="text-xs font-semibold uppercase tracking-wide text-sky-950">Location map</p>
      <p className="mt-1 text-[11px] leading-snug text-sky-900">
        This file is in the <strong className="font-semibold">Location</strong> image folder. Save WGS84 coordinates to
        show a pin on the{" "}
        <Link href="/map" className="font-medium text-sky-950 underline underline-offset-2">
          evidence map
        </Link>
        .
      </p>
      <form className="mt-2 flex flex-wrap items-end gap-2" onSubmit={onSave}>
        <div>
          <label className="block text-[10px] font-medium text-sky-900" htmlFor={`ev-geo-lat-${evidenceId}`}>
            Latitude
          </label>
          <input
            id={`ev-geo-lat-${evidenceId}`}
            type="text"
            inputMode="decimal"
            className="mt-0.5 h-8 w-28 rounded border border-sky-700/50 bg-white px-2 text-xs text-foreground"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            placeholder="-90…90"
            autoComplete="off"
          />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-sky-900" htmlFor={`ev-geo-lng-${evidenceId}`}>
            Longitude
          </label>
          <input
            id={`ev-geo-lng-${evidenceId}`}
            type="text"
            inputMode="decimal"
            className="mt-0.5 h-8 w-28 rounded border border-sky-700/50 bg-white px-2 text-xs text-foreground"
            value={lng}
            onChange={(e) => setLng(e.target.value)}
            placeholder="-180…180"
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="h-8 rounded-md bg-sky-800 px-3 text-xs font-medium text-white hover:bg-sky-900 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </form>
      {error ? <p className="mt-1.5 text-xs text-red-700">{error}</p> : null}
      {saved ? (
        <p className="mt-1.5 text-xs font-medium text-emerald-800">Saved. Open the map to see the pin.</p>
      ) : null}
    </div>
  );
}
