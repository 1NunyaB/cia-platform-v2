import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listRecentDashboardChat } from "@/services/collaboration-service";
import { fetchProfilesByIds } from "@/lib/profiles";
import {
  getEvidenceCaseMembershipCounts,
  getEvidenceContentDuplicatePeerFlags,
  getEvidenceHasAiAnalysisMap,
  getEvidenceViewedSet,
  isEvidenceCaseMembershipTableError,
  listEvidenceVisible,
} from "@/services/evidence-service";
import { DashboardMainPanels } from "@/components/dashboard-main-panels";
import { Button } from "@/components/ui/button";
import { getGuestSessionIdFromCookies } from "@/lib/guest-session";
import { isPlatformDeleteAdmin } from "@/lib/admin-guard";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string }>;
}) {
  const supabase = await createClient();
  const { caseId } = await searchParams;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const guestId = await getGuestSessionIdFromCookies();

  if (!user && !guestId) {
    return null;
  }

  if (!user && guestId) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            You’re browsing as a guest. Open the evidence library to upload and review files, or sign in for cases and
            saved progress.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 rounded-lg border border-sky-300/80 bg-sky-50/90 px-3 py-3 shadow-sm">
          <Button asChild className="bg-primary text-primary-foreground">
            <Link href="/evidence">Evidence library</Link>
          </Button>
          <Button variant="outline" asChild className="border-border bg-card text-foreground">
            <Link href="/login">Sign in</Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/signup">Create account</Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Guest usage may be logged with technical identifiers (such as IP address and browser or device metadata) for
          security, moderation, and evidence integrity. Signing in links activity to your account.
        </p>
      </div>
    );
  }

  let chatMessages: Awaited<ReturnType<typeof listRecentDashboardChat>> = [];
  try {
    chatMessages = await listRecentDashboardChat(supabase, 200);
  } catch {
    chatMessages = [];
  }

  const chatAuthorIds = [...new Set(chatMessages.map((m) => m.author_id).filter(Boolean))] as string[];
  const chatProfiles = await fetchProfilesByIds(supabase, chatAuthorIds);

  let evidenceRows: {
    id: string;
    original_filename: string;
    display_filename: string | null;
    short_alias: string | null;
    created_at: string;
    case_id: string | null;
    source_type: string | null;
    source_platform: string | null;
    source_program: string | null;
    processing_status: import("@/types").EvidenceProcessingStatus;
    extraction_status: string | null;
    case_membership_count: number;
    has_ai_analysis: boolean;
    viewed: boolean;
    has_content_duplicate_peer: boolean;
  }[] = [];
  try {
    const all = await listEvidenceVisible(supabase);
    const visible = all.map((r) => ({
      id: r.id as string,
      original_filename: ((r.original_filename as string) ?? "File").trim() || "File",
      display_filename: (r.display_filename as string | null) ?? null,
      short_alias: (r.short_alias as string | null) ?? null,
      created_at: (r.created_at as string) ?? "",
      case_id: (r.case_id as string | null) ?? null,
      source_type: (r.source_type as string | null) ?? null,
      source_platform: (r.source_platform as string | null) ?? null,
      source_program: (r.source_program as string | null) ?? null,
      processing_status: r.processing_status as import("@/types").EvidenceProcessingStatus,
      extraction_status: (r.extraction_status as string | null) ?? null,
      content_sha256: (r.content_sha256 as string | null) ?? null,
    }));

    let rows = visible;
    if (caseId) {
      const membershipIds = new Set<string>();
      const membershipRes = await supabase
        .from("evidence_case_memberships")
        .select("evidence_file_id")
        .eq("case_id", caseId);
      if (!membershipRes.error) {
        for (const m of membershipRes.data ?? []) {
          membershipIds.add(m.evidence_file_id as string);
        }
      } else if (!isEvidenceCaseMembershipTableError(membershipRes.error)) {
        throw new Error(membershipRes.error.message);
      }
      rows = visible.filter((r) => r.case_id === caseId || membershipIds.has(r.id));
    } else {
      rows = visible.slice(0, 24);
    }

    const ids = rows.map((r) => r.id);
    const [counts, hasAi, viewedSet, dupFlags] = await Promise.all([
      getEvidenceCaseMembershipCounts(supabase, ids),
      getEvidenceHasAiAnalysisMap(supabase, ids),
      user ? getEvidenceViewedSet(supabase, user.id, ids) : Promise.resolve(new Set<string>()),
      getEvidenceContentDuplicatePeerFlags(supabase, { userId: user!.id }, rows),
    ]);

    evidenceRows = rows.map((r) => ({
      id: r.id,
      original_filename: r.original_filename,
      display_filename: r.display_filename,
      short_alias: r.short_alias,
      created_at: r.created_at,
      case_id: r.case_id,
      source_type: r.source_type,
      source_platform: r.source_platform,
      source_program: r.source_program,
      processing_status: r.processing_status,
      extraction_status: r.extraction_status,
      case_membership_count: counts.get(r.id) ?? 0,
      has_ai_analysis: hasAi.get(r.id) ?? false,
      viewed: viewedSet.has(r.id),
      has_content_duplicate_peer: dupFlags.get(r.id) ?? false,
    }));
  } catch {
    evidenceRows = [];
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Workspace home — shortcuts, saved workspace chat, and a quick look at recent evidence.
        </p>
      </div>

      <nav
        className="flex flex-wrap gap-2 rounded-lg border border-sky-300/80 bg-sky-50/95 px-3 py-3 shadow-sm"
        aria-label="Dashboard shortcuts"
      >
        <Button asChild size="sm" className="bg-primary text-primary-foreground shadow-sm">
          <Link href="/cases/new">New investigation</Link>
        </Button>
        <Button asChild size="sm" variant="secondary" className="border-border bg-card text-foreground shadow-sm">
          <Link href="/evidence">Evidence library (all files)</Link>
        </Button>
        <Button asChild size="sm" variant="secondary" className="border-border bg-card text-foreground shadow-sm">
          <Link href="/evidence/add">Upload to library without opening a case</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="border-sky-400/80 bg-white text-foreground shadow-sm">
          <Link href="/evidence/compare">Compare two evidence files</Link>
        </Button>
      </nav>
      <p className="text-xs text-muted-foreground leading-relaxed max-w-3xl">
        <span className="font-medium text-foreground">Evidence library</span> lists every file you can access.{" "}
        <span className="font-medium text-foreground">Current case evidence</span> is the list on an open case
        workspace — only items linked to that investigation.
      </p>

      <DashboardMainPanels
        chatMessages={chatMessages}
        chatProfiles={chatProfiles}
        evidenceRows={evidenceRows}
        currentUserId={user?.id ?? null}
        isPlatformAdmin={isPlatformDeleteAdmin(user)}
      />
    </div>
  );
}
