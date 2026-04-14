import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LandingSuggestionBox } from "@/components/landing-suggestion-box";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4">
          <Link href="/" className="font-semibold tracking-tight">
            CIS
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline" className="border-slate-500 bg-slate-900 text-slate-100">
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button asChild size="sm" className="bg-sky-500 text-slate-950 hover:bg-sky-400">
              <Link href="/login">Log in</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-16">
        <section className="relative overflow-hidden rounded-2xl border border-sky-300/25 bg-gradient-to-br from-sky-900 via-slate-900 to-indigo-950 px-6 py-16 shadow-2xl shadow-sky-900/30 sm:px-10">
          <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-indigo-400/20 blur-3xl" />
          <div className="relative max-w-3xl space-y-6">
            <p className="inline-flex rounded-full border border-cyan-300/30 bg-cyan-400/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
              CIS — Collaborative Investigation Sleuths
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Built for high-stakes evidence review.
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-200 sm:text-base">
              Built for the investigations people still question.
              <br />
              Collaborative Investigation Sleuths gives amateurs and professionals the tools to analyze evidence, connect
              patterns, and push cases forward — together.
              <br />
              Have an idea or feature you want to see? Drop it in the suggestion box and help shape the platform.
            </p>
          </div>
        </section>

        <section className="mt-8 grid gap-6 lg:grid-cols-5">
          <div className="rounded-xl border border-white/10 bg-slate-900/70 p-5 lg:col-span-3">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Featured media block</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">Your investigation intro reel</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Drop in a briefing video, source overview, or case intro reel here. The layout is ready for background
              video integration while preserving high-contrast overlays and readable text.
            </p>
            <div className="mt-4 aspect-video rounded-lg border border-sky-300/25 bg-gradient-to-br from-slate-900 via-sky-950/40 to-slate-800 p-4">
              <div className="flex h-full items-center justify-center rounded-md border border-dashed border-sky-300/30 text-sm text-slate-300">
                Video-ready presentation area
              </div>
            </div>
          </div>
          <div className="space-y-3 lg:col-span-2">
            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Origin</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">
                Started with Epstein file investigation workflows; engineered for reusable, structured case operations.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-900/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Expansion</p>
              <p className="mt-2 text-sm leading-relaxed text-slate-200">
                Now supports broader investigations across legal, corporate, media, and open-source intelligence work.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-white/10 bg-slate-900/75 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">What this platform does</p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[
              "Evidence review and triage",
              "Document viewing and analysis",
              "Timeline construction and correlation",
              "Entity/claim clustering",
              "Contradiction and corroboration review",
              "Media analysis and contextual checks",
              "Collaborative case workspaces",
              "Shared markers and investigation status",
              "AI-assisted comparative review",
            ].map((item) => (
              <div key={item} className="rounded-lg border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-100">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section className="mt-8 rounded-2xl border border-sky-300/20 bg-gradient-to-r from-slate-900 to-slate-800 p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">Roadmap-ready sections</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
              <h3 className="text-lg font-semibold text-white">Video Evidence page</h3>
              <p className="mt-2 text-sm text-slate-300">
                Placeholder structure is ready for dedicated video ingest, frame review, and timeline pinning.
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-slate-950/60 p-4">
              <h3 className="text-lg font-semibold text-white">Audio Analyzer page</h3>
              <p className="mt-2 text-sm text-slate-300">
                Placeholder structure is ready for transcript alignment, speaker signals, and audio anomaly review.
              </p>
            </div>
          </div>
        </section>

        <LandingSuggestionBox />
      </main>

      <footer className="border-t border-white/10 bg-slate-950/70 px-4 py-4 text-center text-xs text-slate-400">
        Built for rigorous investigation workflows with readable, high-contrast presentation surfaces.
      </footer>
    </div>
  );
}
