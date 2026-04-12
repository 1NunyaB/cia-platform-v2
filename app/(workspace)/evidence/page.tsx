import { createClient } from "@/lib/supabase/server";
import {
  findEvidenceIdsMatchingExtractedText,
  getEvidenceCaseMembershipCounts,
  getEvidenceHasAiAnalysisMap,
  listEvidenceVisible,
} from "@/services/evidence-service";
import { CaseEvidenceAddPanel } from "@/components/case-evidence-add-panel";
import { EvidenceLibraryClient } from "@/components/evidence-library-client";

export default async function EvidenceLibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q: qRaw } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  let rows = await listEvidenceVisible(supabase);
  const needle = (qRaw ?? "").trim();
  if (needle.length >= 2) {
    const nl = needle.toLowerCase();
    const fromExtract = await findEvidenceIdsMatchingExtractedText(supabase, needle);
    rows = rows.filter((r) => {
      const id = r.id as string;
      if (fromExtract.has(id)) return true;
      return (
        String(r.original_filename).toLowerCase().includes(nl) ||
        String(r.display_filename ?? "").toLowerCase().includes(nl) ||
        String(r.short_alias ?? "").toLowerCase().includes(nl)
      );
    });
  }

  const ids = rows.map((r) => r.id as string);
  const [counts, hasAi] = await Promise.all([
    getEvidenceCaseMembershipCounts(supabase, ids),
    getEvidenceHasAiAnalysisMap(supabase, ids),
  ]);

  const enriched = rows.map((r) => ({
    ...r,
    case_id: (r.case_id as string | null) ?? null,
    case_membership_count: counts.get(r.id as string) ?? 0,
    has_ai_analysis: hasAi.get(r.id as string) ?? false,
  }));

  return (
    <div className="space-y-8 max-w-4xl">
      <CaseEvidenceAddPanel mode="library" />
      <EvidenceLibraryClient rows={enriched} initialQuery={needle} />
    </div>
  );
}
