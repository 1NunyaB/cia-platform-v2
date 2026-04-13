import { createClient } from "@/lib/supabase/server";
import { getGuestSessionIdFromCookies } from "@/lib/guest-session";
import { tryCreateServiceClient } from "@/lib/supabase/service";
import { listEvidenceVisible, listGuestEvidence } from "@/services/evidence-service";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";
import { MediaEvidenceBrowser } from "@/components/media-evidence-browser";

function looksAudio(r: { mime_type?: string | null; original_filename?: string | null }) {
  const mt = String(r.mime_type ?? "").toLowerCase();
  if (mt.startsWith("audio/")) return true;
  const name = String(r.original_filename ?? "").toLowerCase();
  return [".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"].some((ext) => name.endsWith(ext));
}

export default async function AudioAnalyzerPage() {
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
    .filter((r) => looksAudio(r as { mime_type?: string | null; original_filename?: string | null }))
    .map((r) => ({
      id: r.id as string,
      title: evidencePrimaryLabel({
        display_filename: (r.display_filename as string | null) ?? null,
        original_filename: (r.original_filename as string) ?? "Audio",
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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Audio Analyzer</h1>
        <p className="text-sm text-muted-foreground">
          Review uploaded audio evidence with playback, waveform foundation, and timeline scrubbing. Layout is ready
          for transcript display and timestamped note-taking.
        </p>
      </div>
      <MediaEvidenceBrowser mode="audio" rows={mediaRows} />
    </div>
  );
}

