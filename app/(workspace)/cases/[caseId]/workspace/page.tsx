import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCaseById, getCaseMembers } from "@/services/case-service";
import {
  getEvidenceCaseMembershipCounts,
  getEvidenceContentDuplicatePeerFlags,
  getEvidenceForCase,
  getEvidenceHasAiAnalysisMap,
  getEvidenceViewedSet,
} from "@/services/evidence-service";
import { DashboardMainPanels } from "@/components/dashboard-main-panels";
import { CaseWorkspaceRealtime } from "@/components/case-workspace-realtime";
import { fetchProfilesByIds } from "@/lib/profiles";
import { Button } from "@/components/ui/button";
import { StartInvestigationButton } from "@/components/start-investigation-button";
import { PutOnHoldButton } from "@/components/put-on-hold-button";
import { AnalyzeCaseButton } from "@/components/analyze-case-button";

export default async function CaseWorkspacePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const c = await getCaseById(supabase, caseId);
  if (!c) notFound();

  const [members, evidence] = await Promise.all([getCaseMembers(supabase, caseId), getEvidenceForCase(supabase, caseId)]);
  const profileIds = members.map((m) => m.user_id as string);
  const profiles = await fetchProfilesByIds(supabase, profileIds);
  const evidenceIds = evidence.map((row) => String(row.id));
  const evidenceRowsForDup = evidence.map((row) => ({
    id: String(row.id),
    content_sha256: (row.content_sha256 as string | null) ?? null,
  }));
  const [membershipCounts, hasAiMap, viewedSet, dupFlags] = await Promise.all([
    getEvidenceCaseMembershipCounts(supabase, evidenceIds),
    getEvidenceHasAiAnalysisMap(supabase, evidenceIds),
    getEvidenceViewedSet(supabase, user.id, evidenceIds),
    getEvidenceContentDuplicatePeerFlags(supabase, { userId: user.id }, evidenceRowsForDup),
  ]);

  const evidenceRows = evidence.map((row) => ({
    id: String(row.id),
    case_id: row.case_id != null ? String(row.case_id) : null,
    case_membership_count: membershipCounts.get(String(row.id)) ?? 0,
    has_ai_analysis: hasAiMap.get(String(row.id)) ?? false,
    viewed: viewedSet.has(String(row.id)),
    has_content_duplicate_peer: dupFlags.get(String(row.id)) ?? false,
    extraction_status: (row as { extraction_status?: string | null }).extraction_status ?? null,
    original_filename: String(row.original_filename),
    display_filename: row.display_filename != null ? String(row.display_filename) : null,
    short_alias: row.short_alias != null ? String(row.short_alias) : null,
    file_sequence_number:
      row.file_sequence_number != null && row.file_sequence_number !== undefined
        ? Number(row.file_sequence_number)
        : null,
    mime_type: row.mime_type != null ? String(row.mime_type) : null,
    processing_status: row.processing_status as import("@/types").EvidenceProcessingStatus,
    created_at: row.created_at != null ? String(row.created_at) : "",
    source_type: row.source_type != null ? String(row.source_type) : null,
    source_platform: row.source_platform != null ? String(row.source_platform) : null,
    source_program: row.source_program != null ? String(row.source_program) : null,
    source_url: row.source_url != null ? String(row.source_url) : null,
  }));

  const status = c.investigation_on_hold_at ? "On hold" : c.investigation_started_at ? "Active" : "Not started";

  return (
    <div className="space-y-5">
      <CaseWorkspaceRealtime caseId={caseId} />
      <section className="rounded-lg border border-slate-500/75 bg-gradient-to-br from-slate-800 to-slate-900 p-3 text-slate-100 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-slate-300">
              <Link href="/cases" className="hover:underline">
                Cases
              </Link>{" "}
              / {c.title}
            </p>
            <p className="truncate text-lg font-semibold">{c.title}</p>
            <p className="text-xs text-slate-300">Status: {status}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {members.slice(0, 8).map((m) => (
              <span key={m.id} className="relative inline-flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-slate-700 text-[10px] font-semibold uppercase text-slate-100">
                {(profiles[m.user_id as string]?.display_name ?? m.user_id ?? "?").slice(0, 1)}
                <span
                  className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-slate-900 ${
                    (m.investigator_presence ?? "active") === "away" ? "bg-red-500" : "bg-emerald-400"
                  }`}
                  title={(m.investigator_presence ?? "active") === "away" ? "Away" : "Active"}
                />
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {!c.investigation_started_at ? <StartInvestigationButton caseId={caseId} /> : null}
            <Button size="sm" variant="outline" className="h-8" asChild>
              <Link href={`/cases/${caseId}/evidence/add`}>Add Evidence</Link>
            </Button>
            <AnalyzeCaseButton caseId={caseId} />
            {c.investigation_started_at ? <PutOnHoldButton caseId={caseId} disabled={Boolean(c.investigation_on_hold_at)} /> : null}
          </div>
        </div>
      </section>

      <DashboardMainPanels
        initialEvidenceRows={evidenceRows.map((row) => ({
          id: row.id,
          original_filename: row.original_filename,
          display_filename: row.display_filename,
          short_alias: row.short_alias,
          created_at: row.created_at,
          case_id: row.case_id,
          source_type: row.source_type,
          source_platform: row.source_platform,
          source_program: row.source_program,
          processing_status: row.processing_status,
          extraction_status: row.extraction_status,
          case_membership_count: row.case_membership_count,
          has_ai_analysis: row.has_ai_analysis,
          viewed: row.viewed,
          has_content_duplicate_peer: row.has_content_duplicate_peer,
        }))}
        casesForAssign={[
          {
            id: String(c.id),
            title: String(c.title ?? "Untitled"),
            incident_city: (c.incident_city as string | null) ?? null,
            incident_state: (c.incident_state as string | null) ?? null,
            investigation_started_at: (c.investigation_started_at as string | null) ?? null,
            investigation_on_hold_at: (c.investigation_on_hold_at as string | null) ?? null,
          },
        ]}
        activeCaseId={caseId}
      />
    </div>
  );
}

