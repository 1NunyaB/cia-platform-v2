"use client";

import * as React from "react";
import { AudioWaveform, Clock3, Sparkles, Waves, FileText, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function formatTimestamp(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function AudioEvidenceAnalysisStarter() {
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const [src, setSrc] = React.useState("");
  const [currentTime, setCurrentTime] = React.useState(0);

  return (
    <div className="space-y-4">
      <Card className="border-slate-500/70 bg-gradient-to-br from-slate-800 to-slate-900 text-slate-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Audio Evidence</CardTitle>
          <CardDescription className="text-xs text-slate-300">
            Live now: playback, timestamp tracking, and notes capture.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-slate-600/80 bg-slate-950/50 p-3">
            <audio
              ref={audioRef}
              src={src || undefined}
              controls
              className="w-full"
              onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime ?? 0)}
            />
            {!src ? <p className="mt-2 text-xs text-slate-400">Add an audio URL below to begin listening review.</p> : null}
          </div>

          <Input
            placeholder="Audio URL (optional starter input)"
            value={src}
            onChange={(e) => setSrc(e.target.value)}
            className="h-8 border-slate-500 bg-slate-900 text-slate-100"
          />

          <div className="rounded border border-slate-600/80 bg-slate-900/60 px-2 py-1.5 text-xs">
            <p className="text-slate-300">Current timestamp</p>
            <p className="font-mono text-slate-100">{formatTimestamp(currentTime)}</p>
          </div>

          <Textarea
            placeholder="Observations at current timestamp..."
            className="min-h-[110px] border-slate-500 bg-slate-900 text-slate-100"
          />
        </CardContent>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <ScaffoldCard
          icon={Waves}
          title="Waveform"
          text="Scaffold: waveform visualization and segment pinning for quick navigation."
        />
        <ScaffoldCard
          icon={FileText}
          title="Transcript alignment"
          text="Scaffold: transcript lines synchronized to playback timestamps."
        />
        <ScaffoldCard
          icon={AlertTriangle}
          title="Anomaly review"
          text="Scaffold: mark spikes, silence breaks, and suspicious acoustic patterns."
        />
        <ScaffoldCard
          icon={Sparkles}
          title="Future AI-assisted audio review"
          text="Scaffold: summarize conversations and flag inconsistencies against case context."
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

