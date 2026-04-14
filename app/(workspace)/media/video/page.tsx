import { createClient } from "@/lib/supabase/server";
import { getGuestSessionIdFromCookies } from "@/lib/guest-session";
import { tryCreateServiceClient } from "@/lib/supabase/service";
import { listEvidenceVisible, listGuestEvidence } from "@/services/evidence-service";
import Link from "next/link";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";
import { MediaEvidenceBrowser } from "@/components/media-evidence-browser";

function looksVideo(r: { mime_type?: string | null; original_filename?: string | null }) {
  const mt = String(r.mime_type ?? "").toLowerCase();
  if (mt.startsWith("video/")) return true;
  const name = String(r.original_filename ?? "").toLowerCase();
  return [".mp4", ".webm", ".mov", ".m4v", ".avi", ".mkv"].some((ext) => name.endsWith(ext));
}

export default async function VideoEvidencePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const guestId = await getGuestSessionIdFromCookies();

  let rows: Awaited<ReturnType<typeof listEvidenceVisible>> = [];
  if (user) {
    rows = await listEvidenceVisible(supabase);
  } else if (guestId) {
    const service = tryCreateServiceClient();
    rows = service ? await listGuestEvidence(service, guestId) : [];
  }

  const mediaRows = rows
    .filter((r) => looksVideo(r as { mime_type?: string | null; original_filename?: string | null }))
    .map((r) => ({
      id: r.id as string,
      title: evidencePrimaryLabel({
        display_filename: (r.display_filename as string | null) ?? null,
        original_filename: (r.original_filename as string) ?? "Video",
      }),
      mimeType: (r.mime_type as string | null) ?? null,
      createdAt: (r.created_at as string) ?? "",
      caseId: (r.case_id as string | null) ?? null,
      sourceLabel:
        ((r.source_program as string | null) ?? "").trim() ||
        ((r.source_platform as string | null) ?? "").trim() ||
        null,
    }));

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="space-y-1">
        <p className="text-sm">
          <Link href="/analyze" className="font-medium text-primary hover:underline">
            ← Analyze hub
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Video Evidence</h1>
        <p className="text-sm text-muted-foreground">
          Review uploaded video evidence with playback and timeline scrubbing. Layout is ready for frame capture, clip
          review, and note-link workflows.
        </p>
      </div>
      <MediaEvidenceBrowser mode="video" rows={mediaRows} />
    </div>
  );
}

