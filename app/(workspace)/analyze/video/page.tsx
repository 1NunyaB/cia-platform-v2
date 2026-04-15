import Link from "next/link";
import { Video } from "lucide-react";
import { VideoEvidenceAnalysisStarter } from "@/components/video-evidence-analysis-starter";

export default function AnalyzeVideoPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 text-foreground">
      <p className="text-sm text-muted-foreground">
        <Link href="/analyze" className="hover:underline">
          Analyze
        </Link>
      </p>
      <div className="flex items-center gap-2">
        <Video className="h-5 w-5 text-sky-900" />
        <h1 className="text-2xl font-semibold tracking-tight">Video Evidence Analysis</h1>
      </div>
      <p className="text-sm text-foreground/90">
        Starter framework: core playback and note capture are live, with scaffold blocks ready for expansion.
      </p>
      <VideoEvidenceAnalysisStarter />
    </div>
  );
}

