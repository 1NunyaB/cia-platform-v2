"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProtectedEvidenceView } from "@/components/protected-evidence-view";
import { InvestigationLoadingIndicator } from "@/components/investigation-loading-indicator";

type MediaRow = {
  id: string;
  title: string;
  mimeType: string | null;
  createdAt: string;
  caseId: string | null;
  sourceLabel: string | null;
};

type FileUrlPayload = { url: string; mimeType: string | null; filename: string; viewerLabel: string };

export function MediaEvidenceBrowser({
  mode,
  rows,
}: {
  mode: "video" | "audio";
  rows: MediaRow[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(rows[0]?.id ?? null);
  const [payload, setPayload] = useState<FileUrlPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement | null>(null);

  const selected = useMemo(() => rows.find((r) => r.id === selectedId) ?? null, [rows, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setPayload(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDuration(0);
    setCurrentTime(0);
    (async () => {
      try {
        const res = await fetch(`/api/evidence/${selectedId}/file-url`);
        const data = (await res.json()) as FileUrlPayload & { error?: string };
        if (cancelled) return;
        if (!res.ok) {
          setError(data.error ?? "Could not load media.");
          setPayload(null);
        } else {
          setPayload(data);
        }
      } catch {
        if (!cancelled) {
          setError("Could not load media.");
          setPayload(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const mediaHref = selected ? (selected.caseId ? `/cases/${selected.caseId}/evidence/${selected.id}` : `/evidence/${selected.id}`) : null;

  const scrubValue = duration > 0 ? Math.min(currentTime, duration) : 0;

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <Card className="lg:col-span-4 border-border bg-card shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground">
            {mode === "video" ? "Video evidence" : "Audio evidence"}
          </CardTitle>
          <CardDescription>Select an item to open it in the media viewer.</CardDescription>
        </CardHeader>
        <CardContent className="pt-0">
          {rows.length === 0 ? (
            <p className="rounded-md border border-border bg-panel px-3 py-3 text-sm text-muted-foreground">
              No {mode} evidence available yet.
            </p>
          ) : (
            <ul className="max-h-[62vh] divide-y divide-border overflow-y-auto rounded-md border border-border bg-panel">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className={`w-full px-3 py-2.5 text-left ${
                      selectedId === r.id ? "bg-sky-100/90" : "hover:bg-muted/50"
                    }`}
                  >
                    <p className="truncate text-sm font-medium text-foreground">{r.title}</p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {r.sourceLabel || "Source not labeled"} · {new Date(r.createdAt).toLocaleString()}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <div className="space-y-4 lg:col-span-8">
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-foreground">
              {mode === "video" ? "Playback + timeline scrub" : "Playback + analysis rail"}
            </CardTitle>
            <CardDescription>
              {mode === "video"
                ? "Foundation for frame capture, clip review, and note-linking."
                : "Foundation for waveform, transcript alignment, and timestamped notes."}
            </CardDescription>
            <p className="text-[11px] text-foreground/90">
              In-app review only. Watermarking and blocked context/copy actions are deterrents and cannot fully prevent
              screenshots or external recording.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? <InvestigationLoadingIndicator inline label="Scanning media..." /> : null}
            {error ? <p className="text-sm text-rose-700">{error}</p> : null}
            {!loading && !error && payload ? (
              <>
                {mode === "video" ? (
                  <ProtectedEvidenceView viewerLabel={payload.viewerLabel} className="rounded-lg border border-border bg-black p-1">
                    <video
                      ref={(el) => {
                        mediaRef.current = el;
                      }}
                      src={payload.url}
                      controls
                      controlsList="nodownload noplaybackrate"
                      disablePictureInPicture
                      className="w-full rounded-lg border border-border bg-black"
                      onLoadedMetadata={(e) => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
                      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    />
                  </ProtectedEvidenceView>
                ) : (
                  <ProtectedEvidenceView viewerLabel={payload.viewerLabel} className="space-y-3 rounded-lg border border-border bg-panel p-4">
                    <audio
                      ref={(el) => {
                        mediaRef.current = el;
                      }}
                      src={payload.url}
                      controls
                      controlsList="nodownload noplaybackrate"
                      className="w-full"
                      onLoadedMetadata={(e) => setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)}
                      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                    />
                    <WaveformPlaceholder />
                  </ProtectedEvidenceView>
                )}
                <div className="space-y-2 rounded-md border border-border bg-panel p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Timeline scrub</p>
                  <input
                    type="range"
                    min={0}
                    max={Math.max(duration, 1)}
                    step={0.1}
                    value={scrubValue}
                    onChange={(e) => {
                      const t = Number(e.target.value);
                      setCurrentTime(t);
                      if (mediaRef.current) mediaRef.current.currentTime = t;
                    }}
                    className="w-full accent-sky-600"
                  />
                  <p className="text-xs text-muted-foreground">
                    {formatSeconds(currentTime)} / {formatSeconds(duration)}
                  </p>
                </div>
                {mediaHref ? (
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm">
                      <Link href={mediaHref}>Open evidence detail</Link>
                    </Button>
                  </div>
                ) : null}
              </>
            ) : null}
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground">
                {mode === "video" ? "Frame capture + clip review" : "Transcript panel"}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {mode === "video"
                ? "Reserved panel for frame grabs, shot markers, and exportable clip boundaries."
                : "Reserved panel for transcript blocks aligned to playback timestamps."}
            </CardContent>
          </Card>
          <Card className="border-border bg-card shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-foreground">Timestamped notes</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Prepared layout for linking notes to current playback time and evidence references.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function WaveformPlaceholder() {
  const bars = Array.from({ length: 48 }, (_, i) => (i % 7) + 2 + (i % 3));
  return (
    <div className="rounded-md border border-border bg-slate-950 px-3 py-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-200">Waveform (foundation)</p>
      <div className="flex h-14 items-end gap-1">
        {bars.map((h, i) => (
          <span
            key={i}
            className="w-1.5 rounded-sm bg-cyan-400/80"
            style={{ height: `${h * 9}%` }}
            aria-hidden
          />
        ))}
      </div>
    </div>
  );
}

function formatSeconds(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0:00";
  const total = Math.floor(value);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

