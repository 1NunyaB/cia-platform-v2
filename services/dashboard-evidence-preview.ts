/**
 * Server-side loader for dashboard evidence preview rows.
 * Used by the API route so heavy lists are not serialized through RSC props.
 */
import type { AppSupabaseClient } from "@/types";
import type { DashboardEvidencePreviewRow } from "@/components/dashboard-evidence-preview";
import {
  getEvidenceCaseMembershipCounts,
  getEvidenceContentDuplicatePeerFlags,
  getEvidenceHasAiAnalysisMap,
  getEvidenceViewedSet,
  isEvidenceCaseMembershipTableError,
  listEvidenceVisible,
} from "@/services/evidence-service";

/** Max rows when filtering by case (bounded API + client payload). */
export const DASHBOARD_EVIDENCE_ROW_CAP = 40;

/** Unscoped dashboard list size (matches previous server page behavior). */
export const DASHBOARD_EVIDENCE_DEFAULT_SLICE = 24;

export async function loadDashboardEvidencePreviewRows(
  supabase: AppSupabaseClient,
  userId: string,
  caseId: string | null,
): Promise<{ rows: DashboardEvidencePreviewRow[]; capped: boolean }> {
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
    if (membershipRes.error) {
      if (!isEvidenceCaseMembershipTableError(membershipRes.error)) {
        throw new Error(membershipRes.error.message);
      }
    } else {
      for (const m of membershipRes.data ?? []) {
        membershipIds.add(m.evidence_file_id as string);
      }
    }
    rows = visible.filter((r) => r.case_id === caseId || membershipIds.has(r.id));
  } else {
    rows = visible;
  }

  const limit = caseId ? DASHBOARD_EVIDENCE_ROW_CAP : DASHBOARD_EVIDENCE_DEFAULT_SLICE;
  const preCap = rows.length;
  rows = rows.slice(0, limit);
  const capped = preCap > limit;

  const ids = rows.map((r) => r.id);
  const [counts, hasAi, viewedSet, dupFlags] = await Promise.all([
    getEvidenceCaseMembershipCounts(supabase, ids),
    getEvidenceHasAiAnalysisMap(supabase, ids),
    getEvidenceViewedSet(supabase, userId, ids),
    getEvidenceContentDuplicatePeerFlags(supabase, { userId }, rows),
  ]);

  const evidenceRows: DashboardEvidencePreviewRow[] = rows.map((r) => ({
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

  return { rows: evidenceRows, capped };
}
