"use client";

import Link from "next/link";
import { AnalyzeImageAnalysisSection } from "@/components/analyze-image-analysis-section";

const VideoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z" />
  </svg>
);

const AudioIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53L6.75 15.75H4.5a.75.75 0 01-.75-.75v-6a.75.75 0 01.75-.75H6.75z" />
  </svg>
);

const DocIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
  </svg>
);

const ImageIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
  </svg>
);

const CompareIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const LayersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6.429 9.75L2.25 12l4.179 2.25m0-4.5l5.571 3 5.571-3m-11.142 0L2.25 7.5 12 2.25l9.75 5.25-4.179 2.25m0 0L21.75 12l-4.179 2.25m0 0l4.179 2.25L12 21.75 2.25 16.5l4.179-2.25m11.142 0l-5.571 3-5.571-3" />
  </svg>
);

const InfoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-4 h-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
  </svg>
);

const SparkleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-3.5 h-3.5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
  </svg>
);

const secondaryLinkClass =
  "inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-[#1a2335] text-[#94a3b8] border border-[#1e2d42] hover:bg-[#1e2d42] hover:text-[#e2e8f0] hover:border-[#334155] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500/60";

const primaryLinkClass =
  "inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all bg-[#1e40af] border border-[#2563eb] hover:bg-[#1d4ed8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500/60";

const mutedDashedLinkClass =
  "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all bg-transparent text-[#334155] border border-dashed border-[#263347] hover:text-[#94a3b8] hover:border-[#475569] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500/60";

function ActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={secondaryLinkClass}>
      {children}
    </Link>
  );
}

function PrimaryLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={primaryLinkClass}>
      {children}
    </Link>
  );
}

type AnalysisCardProps = {
  icon: React.ReactNode;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  children?: React.ReactNode;
  badge?: string;
  /** Darker panel (Image analysis readability). */
  darkerSurface?: boolean;
  /** Lead description uses text-slate-300 instead of muted gray. */
  highContrastDescription?: boolean;
};

function AnalysisCard({
  icon,
  iconColor,
  iconBg,
  title,
  description,
  children,
  badge,
  darkerSurface,
  highContrastDescription,
}: AnalysisCardProps) {
  return (
    <div
      className="rounded-xl p-4 flex flex-col gap-3 transition-all"
      style={{
        backgroundColor: darkerSurface ? "#0f172a" : "#141e2e",
        border: "1px solid #1e2d42",
      }}
    >
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: iconBg, border: `1px solid ${iconColor}33`, color: iconColor }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {badge && (
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ backgroundColor: "#1e3a5f", color: "#60a5fa", border: "1px solid #2563eb33" }}
              >
                {badge}
              </span>
            )}
          </div>
          <p
            className={`text-xs leading-relaxed ${highContrastDescription ? "text-slate-300" : ""}`}
            style={highContrastDescription ? undefined : { color: "#64748b" }}
          >
            {description}
          </p>
        </div>
      </div>
      {children}
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <div
      className="min-h-screen p-5 font-sans"
      style={{ backgroundColor: "#0f1623", color: "#e2e8f0" }}
    >
      {/* Header */}
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-white mb-1">Analyze</h1>
        <p className="text-sm leading-relaxed max-w-xl" style={{ color: "#64748b" }}>
          One entry point for CIS analysis modes. Open a tool below or jump to your evidence library to run structured AI findings from your files.
        </p>
      </div>

      {/* How this hub fits — info banner */}
      <div
        className="rounded-xl p-4 mb-5 mt-4 flex gap-3"
        style={{ backgroundColor: "#141e2e", border: "1px solid #1e2d42" }}
      >
        <span className="flex-shrink-0 mt-0.5" style={{ color: "#475569" }}>
          <InfoIcon />
        </span>
        <div>
          <p className="text-xs font-semibold text-white mb-1">How this hub fits</p>
          <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>
            Some modes open dedicated workspaces (video/audio browsers, comparison). Others describe planned or case-scoped workflows (timelines, image categories). The layout stays easy to extend as new analysis types ship.
          </p>
        </div>
      </div>

      {/* 2-col grid */}
      <div className="grid grid-cols-2 gap-3 mb-3">

        {/* Video analysis */}
        <AnalysisCard
          icon={<VideoIcon />}
          iconColor="#f97316"
          iconBg="#7c2d1222"
          title="Video analysis"
          description="Review video evidence in-app, tie clips to cases, and pair with transcripts or notes when available."
        >
          <PrimaryLink href="/analyze/video">Open video evidence</PrimaryLink>
        </AnalysisCard>

        {/* Audio analysis */}
        <AnalysisCard
          icon={<AudioIcon />}
          iconColor="#a78bfa"
          iconBg="#3b0f6322"
          title="Audio analysis"
          description="Framework for future listening-room tools — not a full analyzer yet."
          badge="Planned"
        >
          <div
            className="rounded-lg px-3 py-2.5 text-xs"
            style={{
              backgroundColor: "#0f1623",
              border: "1px dashed #2563eb44",
              color: "#60a5fa",
            }}
          >
            Coming structure — detailed audio UI is planned.
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium" style={{ color: "#475569" }}>
              Planned building blocks (scaffold only):
            </p>
            {[
              "Waveform navigation and segment markers",
              "Transcript alignment to time",
              "Timestamp review and annotation",
              "Anomaly / signature review hooks (integrations TBD)",
            ].map((item) => (
              <div key={item} className="flex items-start gap-2">
                <span className="mt-1.5 w-1 h-1 rounded-full flex-shrink-0" style={{ backgroundColor: "#334155" }} />
                <p className="text-xs" style={{ color: "#64748b" }}>{item}</p>
              </div>
            ))}
          </div>
          <ActionLink href="/analyze/audio">Open current audio browser</ActionLink>
        </AnalysisCard>

        {/* Text analysis */}
        <AnalysisCard
          icon={<DocIcon />}
          iconColor="#34d399"
          iconBg="#05281822"
          title="Text analysis"
          description="Structured AI findings — run from an evidence file after you open it from the library or a case."
        >
          <ActionLink href="/evidence">Evidence Library</ActionLink>
        </AnalysisCard>

        {/* Image analysis */}
        <AnalysisCard
          icon={<ImageIcon />}
          iconColor="#60a5fa"
          iconBg="#1e3a5f"
          title="Image analysis"
          description="Organize how you think about still-image evidence. Deep pipelines can attach to these categories over time."
          darkerSurface
          highContrastDescription
        >
          <AnalyzeImageAnalysisSection />
        </AnalysisCard>

        {/* Side-by-side comparison */}
        <AnalysisCard
          icon={<CompareIcon />}
          iconColor="#f59e0b"
          iconBg="#4514001a"
          title="Side-by-side comparison"
          description="Compare two evidence files for wording, structure, or media differences."
        >
          <ActionLink href="/evidence/compare">Open comparison</ActionLink>
        </AnalysisCard>

        {/* Timestamp analysis */}
        <AnalysisCard
          icon={<ClockIcon />}
          iconColor="#2dd4bf"
          iconBg="#04302c22"
          title="Timestamp analysis"
          description="Case timelines, dated events, and tiered time inference live on the case workspace."
        >
          <ActionLink href="/cases">Open cases</ActionLink>
          <p className="text-xs" style={{ color: "#334155" }}>
            Open a case, then use{" "}
            <span className="font-semibold" style={{ color: "#60a5fa" }}>Timeline</span>
            {" "}/{" "}
            <span className="font-semibold" style={{ color: "#60a5fa" }}>Timelines</span>
            {" "}from the case header.
          </p>
        </AnalysisCard>
      </div>

      {/* More modes — full-width dashed card */}
      <div
        className="rounded-xl p-4"
        style={{
          backgroundColor: "#0f1623",
          border: "1px dashed #263347",
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: "#475569" }}>
            <LayersIcon />
          </span>
          <h3 className="text-sm font-semibold text-white">More modes</h3>
        </div>
        <p className="text-xs mb-3" style={{ color: "#64748b" }}>
          Cross-case intelligence, clusters, and investigation actions stay on case and evidence surfaces for now.
        </p>
        <div className="flex flex-wrap gap-2">
          <ActionLink href="/investigators">Investigators</ActionLink>
          <ActionLink href="/evidence/add">Add evidence</ActionLink>
          <Link href="/explore" className={mutedDashedLinkClass} title="Open Explore — investigations and cross-case views">
            <SparkleIcon />
            Room for future analysis tiles
          </Link>
        </div>
      </div>
    </div>
  );
}
