import Link from "next/link";
import { AudioWaveform } from "lucide-react";
import { AudioEvidenceAnalysisStarter } from "@/components/audio-evidence-analysis-starter";

export default function AnalyzeAudioPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 text-foreground">
      <p className="text-sm text-muted-foreground">
        <Link href="/analyze" className="hover:underline">
          Analyze
        </Link>
      </p>
      <div className="flex items-center gap-2">
        <AudioWaveform className="h-5 w-5 text-sky-900" />
        <h1 className="text-2xl font-semibold tracking-tight">Audio Evidence Analysis</h1>
      </div>
      <p className="text-sm text-foreground/90">
        Starter framework: listening review and notes are live, with scaffold blocks reserved for advanced tooling.
      </p>
      <AudioEvidenceAnalysisStarter />
    </div>
  );
}

