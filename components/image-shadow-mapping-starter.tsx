"use client";

import * as React from "react";
import { AlertTriangle, Clock3, Compass, Sun } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type TimeBand = "morning" | "midday" | "afternoon";

function inferTimeBand(obs: string): { band: TimeBand; confidence: "low" | "moderate" } {
  const text = obs.toLowerCase();
  if (text.includes("short") || text.includes("under subject") || text.includes("overhead")) {
    return { band: "midday", confidence: "moderate" };
  }
  if (text.includes("long") && (text.includes("west") || text.includes("left"))) {
    return { band: "morning", confidence: "low" };
  }
  if (text.includes("long") && (text.includes("east") || text.includes("right"))) {
    return { band: "afternoon", confidence: "low" };
  }
  return { band: "midday", confidence: "low" };
}

export function ImageShadowMappingStarter() {
  const [imageUrl, setImageUrl] = React.useState("");
  const [shadowObservation, setShadowObservation] = React.useState("");
  const [locationHint, setLocationHint] = React.useState("");
  const [dateHint, setDateHint] = React.useState("");

  const result = React.useMemo(() => inferTimeBand(shadowObservation), [shadowObservation]);
  const hasObservation = shadowObservation.trim().length > 0;

  return (
    <div className="space-y-4">
      <Card className="border-slate-500/70 bg-gradient-to-br from-slate-800 to-slate-900 text-slate-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Shadow Mapping (Approximate)</CardTitle>
          <CardDescription className="text-xs text-slate-300">
            Assistive natural-light shadow review for time-of-day clues. Not a forensic certainty engine.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-slate-600/80 bg-slate-950/50 p-2">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt="Evidence shadow review"
                className="max-h-[320px] w-full rounded border border-slate-700 object-contain"
              />
            ) : (
              <div className="flex h-40 items-center justify-center rounded border border-dashed border-slate-700 text-xs text-slate-400">
                Image view area — add an image URL below
              </div>
            )}
          </div>

          <Input
            placeholder="Image URL (starter input)"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            className="h-8 border-slate-500 bg-slate-900 text-slate-100"
          />

          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="Optional location (city/region)"
              value={locationHint}
              onChange={(e) => setLocationHint(e.target.value)}
              className="h-8 border-slate-500 bg-slate-900 text-slate-100"
            />
            <Input
              type="date"
              value={dateHint}
              onChange={(e) => setDateHint(e.target.value)}
              className="h-8 border-slate-500 bg-slate-900 text-slate-100"
            />
          </div>

          <Textarea
            value={shadowObservation}
            onChange={(e) => setShadowObservation(e.target.value)}
            placeholder="Shadow observation notes (direction, length, object orientation, surface conditions)"
            className="min-h-[110px] border-slate-500 bg-slate-900 text-slate-100"
          />
        </CardContent>
      </Card>

      <Card className="border-slate-600/80 bg-slate-900/60 text-slate-100">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Shadow Analysis Notes (Starter Output)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs">
          {hasObservation ? (
            <>
              <p className="flex items-center gap-1.5">
                <Clock3 className="h-3.5 w-3.5 text-amber-300" />
                Likely time band:{" "}
                <span className="font-semibold text-slate-100">
                  {result.band === "morning" ? "Morning range" : result.band === "midday" ? "Midday range" : "Afternoon range"}
                </span>
              </p>
              <p className="flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5 text-amber-300" />
                Direction cue: based on user-described shadow direction/length indicators.
              </p>
              <p className="flex items-center gap-1.5">
                <Sun className="h-3.5 w-3.5 text-amber-300" />
                Confidence: <span className="font-semibold">{result.confidence}</span> (approximate inference only)
              </p>
            </>
          ) : (
            <p className="text-slate-300">
              Add shadow observations to generate an approximate morning/midday/afternoon clue.
            </p>
          )}
          <div className="rounded border border-amber-300/40 bg-amber-900/20 px-2 py-1.5 text-amber-100">
            <p className="flex items-center gap-1.5 font-medium">
              <AlertTriangle className="h-3.5 w-3.5" />
              Limitations
            </p>
            <p className="mt-1">
              This output is inferred and approximate. Cloud cover, terrain, camera angle, lens distortion, and unknown
              geolocation/date can materially affect interpretation.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

