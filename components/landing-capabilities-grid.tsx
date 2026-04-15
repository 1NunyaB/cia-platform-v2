"use client";

import { useRef, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  FileSearch,
  Film,
  FolderSearch,
  Radar,
  Users,
  Waypoints,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Capability = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  title: string;
  description: string;
  example?: string;
};

const CAPABILITIES: Capability[] = [
  {
    icon: FileSearch,
    label: "Evidence review",
    title: "Evidence Review",
    description: "Inspect files quickly and surface what is confirmed versus uncertain before deeper analysis.",
    example: "Example: Validate whether two reports describe the same incident details.",
  },
  {
    icon: FolderSearch,
    label: "Document viewing",
    title: "Document Viewing",
    description: "Open and browse case documents with context so investigators can cross-check source material.",
    example: "Example: Open witness statements while reviewing related case notes.",
  },
  {
    icon: Waypoints,
    label: "Timeline construction",
    title: "Timeline Construction",
    description:
      "Build a time-based sequence of events using linked evidence. Track exact or approximate moments in an investigation.",
    example: "Example: Place call logs and sighting reports into one chronological chain.",
  },
  {
    icon: Radar,
    label: "Clustering",
    title: "Clustering",
    description: "Group related evidence and leads to reveal patterns without losing original file context.",
  },
  {
    icon: AlertTriangle,
    label: "Contradiction review",
    title: "Contradiction Review",
    description: "Flag conflicts across sources so teams can challenge assumptions and test alternate narratives.",
  },
  {
    icon: Film,
    label: "Media analysis",
    title: "Media Analysis",
    description: "Track media-based evidence and connect key moments to timeline and location context.",
  },
  {
    icon: Users,
    label: "Collaborative workspace",
    title: "Collaborative Workspace",
    description: "Coordinate investigators in a shared environment while keeping analysis and discussion aligned.",
  },
  {
    icon: Activity,
    label: "Markers / status",
    title: "Markers and Status",
    description: "Use status signals and markers to identify active leads, unresolved items, and verified facts.",
  },
  {
    icon: Bot,
    label: "AI-assisted review",
    title: "AI-Assisted Review",
    description: "Ask focused evidence questions for summaries, clues, and next steps grounded in selected context.",
    example: "Example: Send two files to AI and request inconsistencies only.",
  },
];

const cardBase =
  "relative rounded-md border border-white/[0.06] bg-white/[0.02] transition-[border-color,background-color,box-shadow] duration-150 hover:border-red-300/25 hover:bg-white/[0.05] hover:shadow-[0_1px_12px_-4px_rgba(239,68,68,0.18)] cursor-pointer";

export function LandingCapabilitiesGrid() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Capability | null>(null);
  const lastTriggerRef = useRef<HTMLButtonElement | null>(null);

  function openCapability(item: Capability, el: HTMLButtonElement) {
    lastTriggerRef.current = el;
    setActive(item);
    setOpen(true);
  }

  return (
    <>
      <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2 sm:gap-1.5 lg:grid-cols-3 lg:gap-1.5 xl:grid-cols-4">
        {CAPABILITIES.map((item, idx) => (
          <div key={item.label} className={cardBase}>
            <button
              type="button"
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left outline-none ring-0 focus-visible:ring-2 focus-visible:ring-red-400/40"
              onClick={(e) => openCapability(item, e.currentTarget)}
              aria-haspopup="dialog"
              aria-label={`Open details: ${item.title}`}
            >
              <item.icon
                className={cn("h-3 w-3 shrink-0", idx % 2 === 0 ? "text-red-300/75" : "text-amber-200/70")}
                aria-hidden
              />
              <span className="text-[11px] font-medium leading-none tracking-tight text-slate-100">{item.title}</span>
            </button>
          </div>
        ))}
      </div>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setActive(null);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            lastTriggerRef.current?.focus();
          }}
          className={cn(
            "max-h-[min(88vh,540px)] max-w-md overflow-y-auto border border-sky-400/25 bg-gradient-to-br from-[#1a2332] via-[#151c28] to-[#0f141d] p-5 text-slate-100 shadow-[0_0_48px_-16px_rgba(56,189,248,0.28)] sm:rounded-xl",
            "[&>button.absolute]:right-3 [&>button.absolute]:top-3 [&>button.absolute]:text-slate-300 [&>button.absolute]:opacity-90 [&>button.absolute]:hover:bg-white/10 [&>button.absolute]:hover:text-slate-50 [&>button.absolute]:hover:opacity-100",
          )}
        >
          {active ? (
            <>
              <DialogHeader className="space-y-3 pr-7 text-left">
                <div className="flex items-center gap-2">
                  <active.icon className="h-4 w-4 shrink-0 text-red-300/85" aria-hidden />
                  <DialogTitle className="text-base font-semibold leading-snug text-slate-50">{active.title}</DialogTitle>
                </div>
                <DialogDescription className="text-left text-[13px] leading-relaxed text-slate-300">
                  {active.description}
                </DialogDescription>
                {active.example ? (
                  <div
                    className="rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-2"
                    role="region"
                    aria-label="Example usage"
                  >
                    <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">What this can look like</p>
                    <p className="mt-1 text-[12px] text-slate-400">{active.example}</p>
                  </div>
                ) : null}
              </DialogHeader>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
