import Link from "next/link";
import { Image } from "lucide-react";
import { ImageShadowMappingStarter } from "@/components/image-shadow-mapping-starter";

export default function AnalyzeImageShadowPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-8 text-foreground">
      <p className="text-sm text-muted-foreground">
        <Link href="/analyze" className="hover:underline">
          Analyze
        </Link>
      </p>
      <div className="flex items-center gap-2">
        <Image className="h-5 w-5 text-sky-900" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight">Image Shadow Mapping</h1>
      </div>
      <p className="text-sm text-foreground/90">
        Starter framework for approximate time-of-day clues from natural-light shadows in image evidence.
      </p>
      <ImageShadowMappingStarter />
    </div>
  );
}

