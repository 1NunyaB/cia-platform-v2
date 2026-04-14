import {
  findEvidenceIdsMatchingVisualTags,
  findGuestEvidenceIdsMatchingVisualTags,
  getEvidenceCaseMembershipCounts,
  getEvidenceContentDuplicatePeerFlags,
  getEvidenceHasAiAnalysisMap,
  getEvidenceViewedSet,
  listEvidenceVisible,
  listGuestEvidence,
} from "@/services/evidence-service";
import { effectiveEvidenceKind, parseEvidenceKind } from "@/lib/evidence-kind";
import { CaseEvidenceAddPanel } from "@/components/case-evidence-add-panel";
import { EvidenceLibraryClient } from "@/components/evidence-library-client";
import { listCasesForUser } from "@/services/case-service";
import { createClient } from "@/lib/supabase/server";
import { getGuestSessionIdFromCookies } from "@/lib/guest-session";
import { tryCreateServiceClient } from "@/lib/supabase/service";

export default async function EvidenceLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; kind?: string }>;
}) {
  const { q: qRaw, kind: kindRaw } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const guestId = await getGuestSessionIdFromCookies();

  if (!user && !guestId) {
    return null;
  }

  const needle = (qRaw ?? "").trim();
  const kindFilter = parseEvidenceKind(kindRaw);

  let rows: Awaited<ReturnType<typeof listEvidenceVisible>>;
  if (user) {
    rows = await listEvidenceVisible(supabase);
  } else {
    const service = tryCreateServiceClient();
    if (!service) {
      return (
        <p className="text-sm text-muted-foreground">
          Guest evidence requires server configuration (service role). Set{" "}
          <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> in <code className="text-xs">.env.local</code>.
        </p>
      );
    }
    rows = await listGuestEvidence(service, guestId!);
  }

  if (needle.length >= 2) {
    const nl = needle.toLowerCase();
    let fromVisualTags: Set<string>;
    if (user) {
      fromVisualTags = await findEvidenceIdsMatchingVisualTags(supabase, needle);
    } else {
      const service = tryCreateServiceClient();
      fromVisualTags = service
        ? await findGuestEvidenceIdsMatchingVisualTags(service, guestId!, needle)
        : new Set();
    }
    rows = rows.filter((r) => {
      const id = r.id as string;
      if (fromVisualTags.has(id)) return true;
      return (
        String(r.original_filename).toLowerCase().includes(nl) ||
        String(r.display_filename ?? "").toLowerCase().includes(nl) ||
        String(r.short_alias ?? "").toLowerCase().includes(nl)
      );
    });
  }

  if (kindFilter) {
    rows = rows.filter((r) => effectiveEvidenceKind(r) === kindFilter);
  }

  const ids = rows.map((r) => r.id as string);
  const clientForMembership = user ? supabase : tryCreateServiceClient();
  const dupRows = rows.map((r) => ({
    id: r.id as string,
    content_sha256: (r.content_sha256 as string | null) ?? null,
  }));
  const [counts, hasAi, viewedSet, dupFlags] = await Promise.all([
    clientForMembership
      ? getEvidenceCaseMembershipCounts(clientForMembership, ids)
      : Promise.resolve(new Map<string, number>()),
    clientForMembership
      ? getEvidenceHasAiAnalysisMap(clientForMembership, ids)
      : Promise.resolve(new Map<string, boolean>()),
    user && clientForMembership
      ? getEvidenceViewedSet(supabase, user.id, ids)
      : Promise.resolve(new Set<string>()),
    user && clientForMembership
      ? getEvidenceContentDuplicatePeerFlags(supabase, { userId: user.id }, dupRows)
      : guestId && clientForMembership
        ? getEvidenceContentDuplicatePeerFlags(clientForMembership, { guestSessionId: guestId }, dupRows)
        : Promise.resolve(new Map<string, boolean>()),
  ]);

  const enriched = rows.map((r) => ({
    ...r,
    case_id: (r.case_id as string | null) ?? null,
    case_membership_count: counts.get(r.id as string) ?? 0,
    has_ai_analysis: hasAi.get(r.id as string) ?? false,
    viewed: user ? viewedSet.has(r.id as string) : false,
    has_content_duplicate_peer: dupFlags.get(r.id as string) ?? false,
  }));

  const casesForAssign = user ? await listCasesForUser(supabase, user.id) : [];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <CaseEvidenceAddPanel mode="library" />
      <EvidenceLibraryClient
        rows={enriched}
        initialQuery={needle}
        activeKind={kindFilter}
        signedIn={Boolean(user)}
        casesForAssign={casesForAssign.map((c) => ({
          id: c.id as string,
          title: (c.title as string) ?? "Untitled",
        }))}
      />
    </div>
  );
}
