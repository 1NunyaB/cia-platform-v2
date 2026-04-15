import Link from "next/link";
import type { ComponentType } from "react";
import {
  AudioWaveform,
  Clock,
  FolderOpen,
  Globe2,
  LayoutGrid,
  MessagesSquare,
  Sparkles,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const shell =
  "rounded-xl border border-sky-400/20 bg-gradient-to-br from-[#1a2332] via-[#151c28] to-[#0f141d] shadow-[0_0_32px_-14px_rgba(56,189,248,0.18)]";

const cardClass =
  "flex h-full flex-col gap-2 rounded-lg border border-slate-500/35 bg-slate-950/40 p-3.5 shadow-[inset_0_1px_0_rgba(125,211,252,0.06)] transition-[box-shadow,border-color] hover:border-sky-400/35 hover:shadow-[0_0_28px_-12px_rgba(56,189,248,0.22)]";

type ToolCard = {
  title: string;
  description: string;
  href: string;
  action: string;
  icon: ComponentType<{ className?: string }>;
};

const tools: ToolCard[] = [
  {
    title: "Cases",
    description: "Create, start, and manage investigations.",
    href: "/cases",
    action: "Go to Cases",
    icon: FolderOpen,
  },
  {
    title: "Evidence Library",
    description: "Upload, review, compare, and organize evidence files.",
    href: "/evidence",
    action: "Open Evidence Library",
    icon: LayoutGrid,
  },
  {
    title: "Geo Intelligence",
    description: "Map evidence-linked locations and geographic patterns.",
    href: "/cases",
    action: "Open Geo Intelligence",
    icon: Globe2,
  },
  {
    title: "Timeline",
    description: "Build timelines using exact, approximate, and inferred dates.",
    href: "/cases",
    action: "Open Timeline Tools",
    icon: Clock,
  },
  {
    title: "AI Assistant",
    description: "Summarize evidence, surface contradictions, and suggest next steps.",
    href: "/analyze",
    action: "Open AI Assistant",
    icon: Sparkles,
  },
  {
    title: "Video Analysis",
    description: "Review clips, compare frames, and connect findings to cases.",
    href: "/analyze/video",
    action: "Open Video Analysis",
    icon: Video,
  },
  {
    title: "Audio Analysis",
    description: "Inspect audio, transcripts, speakers, and anomalies.",
    href: "/analyze/audio",
    action: "Open Audio Analysis",
    icon: AudioWaveform,
  },
  {
    title: "Collaboration / Notes",
    description: "Track case notes, shared observations, and team discussion.",
    href: "/cases",
    action: "Open Collaboration",
    icon: MessagesSquare,
  },
];

export function DashboardCommandHub() {
  return (
    <div className={`${shell} p-4 sm:p-6`}>
      <div className="space-y-2 border-b border-sky-400/10 pb-5">
        <h1 className="text-xl font-semibold tracking-tight text-slate-50 sm:text-2xl">Command Center</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-slate-400">
          Use this space to jump into the main CIS tools. Investigations live in Cases, Evidence, Timeline, and analysis
          pages — this dashboard is the hub.
        </p>
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            asChild
            size="sm"
            className="h-8 border-sky-400/40 bg-sky-500/15 text-xs font-medium text-sky-50 shadow-[0_0_20px_-8px_rgba(56,189,248,0.45)] hover:bg-sky-500/25"
          >
            <Link href="/cases/new">New Investigation</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-8 border-slate-500/60 bg-slate-900/50 text-xs text-slate-100 hover:bg-slate-800/80"
          >
            <Link href="/cases">Open Cases</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-8 border-slate-500/60 bg-slate-900/50 text-xs text-slate-100 hover:bg-slate-800/80"
          >
            <Link href="/evidence/add">Upload Evidence</Link>
          </Button>
          <Button
            asChild
            size="sm"
            variant="outline"
            className="h-8 border-slate-500/60 bg-slate-900/50 text-xs text-slate-100 hover:bg-slate-800/80"
          >
            <Link href="/evidence/compare">Compare Files</Link>
          </Button>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {tools.map((t) => {
          const Icon = t.icon;
          return (
            <div key={t.title} className={cardClass}>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-sky-400/25 bg-sky-500/10 text-sky-200 shadow-[0_0_16px_-6px_rgba(56,189,248,0.35)]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="text-sm font-semibold text-slate-100">{t.title}</h2>
                  <p className="text-[12px] leading-snug text-slate-400">{t.description}</p>
                </div>
              </div>
              <div className="mt-auto pt-2">
                <Button
                  asChild
                  size="sm"
                  variant="secondary"
                  className="h-8 w-full border-slate-500/50 bg-slate-800/70 text-xs font-medium text-slate-100 hover:bg-slate-700/90"
                >
                  <Link href={t.href}>{t.action}</Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
