"use client";

import * as React from "react";
import { Clock3, Film, Scissors, Sparkles, Waves } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hh = String(Math.floor(s / 3600)).padStart(2, "0");
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function VideoEvidenceAnalysisStarter() {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [src, setSrc] = React.useState("");
  const [currentTime, setCurrentTime] = React.useState(0);

  return (
    <div className="space-y-4">
      <Card className="border-slate-500/70 bg-gradient-to-br from-slate-800 to-slate-900 text-slate-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Video Evidence</CardTitle>
          <CardDescription className="text-xs text-slate-300">
            Live now: embedded playback, timestamp tracking, and observation notes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-slate-600/80 bg-slate-950/50 p-2">
            <video
              ref={videoRef}
              src={src || undefined}
              controls
              className="aspect-video w-full rounded border border-slate-700 bg-black"
              onTimeUpdate={() => setCurrentTime(videoRef.current?.currentTime ?? 0)}
            />
            {!src ? (
              <p className="mt-2 text-xs text-slate-400">
                Add a local/remote video URL below to start review.
              </p>
            ) : null}
          </div>

          <Input
            placeholder="Video URL (optional starter input)"
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            className="h-8 border-slate-500 bg-slate-900 text-slate-100"
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded border border-slate-600/80 bg-slate-900/60 px-2 py-1.5 text-xs">
              <p className="text-slate-300">Current timestamp</p>
              <p className="font-mono text-slate-100">{formatTimestamp(currentTime)}</p>
            </div>
            <div className="rounded border border-slate-600/80 bg-slate-900/60 px-2 py-1.5 text-xs">
              <p className="text-slate-300">Review marker</p>
              <p className="font-mono text-slate-100">{formatTimestamp(currentTime)} · observation slot</p>
            </div>
          </div>

          <Textarea
            placeholder="Observations at current timestamp..."
            className="min-h-[110px] border-slate-500 bg-slate-900 text-slate-100"
          />
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <ScaffoldCard
          icon={Film}
          title="Frame review"
          text="Scaffold: frame-by-frame stepping, freeze snapshots, and frame annotations."
        />
        <ScaffoldCard
          icon={Scissors}
          title="Clip extraction"
          text="Scaffold: define in/out points and export short clips linked to case evidence."
        />
        <ScaffoldCard
          icon={Waves}
          title="Motion / event notes"
          text="Scaffold: tag movement, interactions, and scene changes with timestamps."
        />
        <ScaffoldCard
          icon={Sparkles}
          title="Future AI-assisted video review"
          text="Scaffold: AI summaries and event detection tied to selected clips."
        />
      </div>
    </div>
  );
}

function ScaffoldCard({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  text: string;
}) {
  return (
    <Card className="border-slate-600/80 bg-slate-900/60 text-slate-100">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="h-4 w-4 text-amber-300" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-slate-300">{text}</p>
      </CardContent>
    </Card>
  );
}

