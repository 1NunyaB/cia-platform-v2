import Link from "next/link";
import { Clapperboard, Mic, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingCapabilitiesGrid } from "@/components/landing-capabilities-grid";
import { LandingSuggestionBox } from "@/components/landing-suggestion-box";

export default function HomePage() {
  return (
    <div className="min-h-screen scroll-smooth bg-[radial-gradient(circle_at_10%_10%,rgba(239,68,68,0.14),transparent_34%),radial-gradient(circle_at_88%_16%,rgba(250,204,21,0.13),transparent_36%),radial-gradient(circle_at_50%_78%,rgba(56,189,248,0.10),transparent_38%),linear-gradient(145deg,#0a1326,#111b33_44%,#1a223b)] text-slate-50">
      <header className="sticky top-0 z-20 border-b border-red-300/25 bg-slate-900/82 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="font-semibold tracking-tight text-white">
            CIS — Collaborative Investigation Sleuths
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="border-yellow-300/80 bg-slate-800/95 text-yellow-100 hover:bg-yellow-300/15 hover:shadow-[0_0_16px_rgba(250,204,21,0.24)]">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild size="sm" className="bg-red-500 text-white shadow-[0_0_20px_rgba(239,68,68,0.45)] hover:bg-red-400 hover:shadow-[0_0_28px_rgba(248,113,113,0.5)]">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm" variant="outline" className="border-slate-400/80 bg-slate-800/85 text-slate-100 hover:bg-slate-700/90">
              <Link href="/dashboard">Guest</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-14">
        <section className="relative mt-6 overflow-hidden rounded-3xl border border-red-300/35 bg-[linear-gradient(145deg,rgba(13,18,36,0.98),rgba(18,24,44,0.96)_54%,rgba(33,21,33,0.95))] px-6 py-10 shadow-[0_0_46px_rgba(239,68,68,0.18)] sm:px-10 sm:py-12">
          <div className="pointer-events-none absolute -right-20 top-2 h-80 w-80 rounded-full bg-red-500/22 blur-3xl" />
          <div className="pointer-events-none absolute -left-20 bottom-0 h-72 w-72 rounded-full bg-yellow-300/18 blur-3xl" />
          <div className="relative mx-auto max-w-3xl space-y-5 text-center">
            <div className="flex justify-center">
              <p className="inline-flex rounded-full border border-red-400/45 bg-red-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-red-200">
                CASE NO. 001 — ACTIVE
              </p>
            </div>
            <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-slate-50 sm:text-5xl [font-family:Georgia,'Times_New_Roman',serif]">
              Where in the world <span className="text-red-300">does the</span>{" "}
              <span className="text-yellow-200">evidence</span> lead?
            </h1>
            <p className="mx-auto max-w-xl text-sm leading-relaxed text-slate-100 sm:text-base">
              Built for the investigations people still question. CIS helps investigators collect, review, correlate, and
              challenge evidence with disciplined collaboration.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-1">
              <Button asChild size="lg" className="bg-red-500 text-white shadow-[0_0_30px_rgba(239,68,68,0.48)] hover:bg-red-400 hover:shadow-[0_0_36px_rgba(248,113,113,0.56)]">
                <Link href="/cases">Open the case files</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-yellow-300/80 bg-transparent text-yellow-100 hover:bg-yellow-300/14 hover:shadow-[0_0_20px_rgba(250,204,21,0.28)]">
                <Link href="#suggest">Drop a lead</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="mt-3 flex justify-center">
          <div className="w-full max-w-md rounded-xl border border-white/10 bg-white/[0.05] p-3 shadow-[0_0_14px_-6px_rgba(15,23,42,0.45)] backdrop-blur-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-yellow-300/95">Briefing reel</p>
              <p className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold text-red-300/95">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500/90 shadow-[0_0_6px_rgba(239,68,68,0.5)]" /> REC
              </p>
            </div>
            <div className="group relative aspect-video w-full overflow-hidden rounded-lg border border-red-300/22 bg-[radial-gradient(circle_at_20%_20%,rgba(239,68,68,0.16),transparent_40%),linear-gradient(150deg,rgba(16,23,42,0.96),rgba(13,18,32,0.94))] p-2">
              <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-white/5" />
              <div className="absolute inset-0 backdrop-blur-[1px]" />
              <div className="relative flex h-full min-h-0 items-center justify-center rounded-md border border-dashed border-white/18 text-slate-200">
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-full border border-red-200/55 bg-red-500/14 px-3 py-1.5 text-xs font-medium text-white shadow-[0_0_14px_-4px_rgba(239,68,68,0.35)] transition group-hover:scale-[1.02] group-hover:shadow-[0_0_18px_-4px_rgba(248,113,113,0.35)]"
                >
                  <Play className="h-3.5 w-3.5 shrink-0 fill-current" aria-hidden /> Play briefing
                </button>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-3 shadow-[0_1px_0_rgba(255,255,255,0.04)_inset] sm:px-3.5 sm:py-3.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-yellow-300/95">Capabilities</p>
          <h2 className="mt-0.5 text-xl font-bold leading-tight tracking-tight text-slate-50 sm:text-2xl [font-family:Georgia,'Times_New_Roman',serif]">
            Every clue covered.
          </h2>
          <LandingCapabilitiesGrid />
        </section>

        <section
          id="roadmap"
          className="mt-5 rounded-xl border border-white/[0.08] bg-[linear-gradient(170deg,rgba(15,22,41,0.88),rgba(33,27,30,0.85))] px-3 py-3 shadow-[0_2px_16px_-6px_rgba(0,0,0,0.35)] sm:px-3.5 sm:py-3.5"
        >
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-yellow-300/95">Roadmap</p>
          <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3">
            <div className="relative overflow-hidden rounded-lg border border-red-300/18 bg-white/[0.04] p-2.5 sm:p-3">
              <Clapperboard className="pointer-events-none absolute -right-2 -top-2 h-9 w-9 text-red-400/[0.09]" aria-hidden />
              <p className="inline-flex rounded-full border border-red-400/25 bg-red-500/[0.07] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-red-200/95">
                Deployment queue
              </p>
              <h3 className="mt-1.5 text-base font-semibold leading-tight text-slate-50">Video Evidence Page</h3>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-3.5 text-[12px] leading-snug text-slate-300">
                <li>Frame-by-frame review workflow</li>
                <li>Scene-to-timeline pinning</li>
                <li>Cross-file media comparison</li>
              </ul>
            </div>
            <div className="relative overflow-hidden rounded-lg border border-yellow-300/18 bg-white/[0.04] p-2.5 sm:p-3">
              <Mic className="pointer-events-none absolute -right-2 -top-2 h-9 w-9 text-yellow-300/[0.09]" aria-hidden />
              <p className="inline-flex rounded-full border border-yellow-300/28 bg-yellow-400/[0.06] px-1.5 py-px text-[9px] font-semibold uppercase tracking-wide text-yellow-200/95">
                Deployment queue
              </p>
              <h3 className="mt-1.5 text-base font-semibold leading-tight text-slate-50">Audio Analyzer</h3>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-3.5 text-[12px] leading-snug text-slate-300">
                <li>Transcript alignment and speaker markers</li>
                <li>Anomaly and contradiction spotting</li>
                <li>Evidence-linked clip annotations</li>
              </ul>
            </div>
          </div>
        </section>

        <LandingSuggestionBox />
      </main>

      <footer className="border-t border-white/12 bg-slate-900/70 px-4 py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 text-xs text-slate-300">
          <p className="font-medium text-slate-100">CIS — Collaborative Investigation Sleuths</p>
          <nav className="flex items-center gap-4">
            <Link href="#features" className="hover:text-yellow-200">
              Features
            </Link>
            <Link href="#roadmap" className="hover:text-yellow-200">
              Roadmap
            </Link>
            <Link href="#suggest" className="hover:text-yellow-200">
              Suggest
            </Link>
            <Link href="/login" className="hover:text-yellow-200">
              Log in
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
