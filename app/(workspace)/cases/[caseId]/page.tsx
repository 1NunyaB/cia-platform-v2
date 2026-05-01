import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCaseById, getCaseMembers } from "@/services/case-service";
import type { CaseRow } from "@/types";
import {
  getEvidenceCaseMembershipCounts,
  getEvidenceContentDuplicatePeerFlags,
  getEvidenceForCase,
  getEvidenceHasAiAnalysisMap,
  getEvidenceViewedSet,
} from "@/services/evidence-service";
import { getCaseIndexSnapshot } from "@/services/case-index-service";
import { listEvidenceClustersForCase } from "@/services/case-investigation-query";
import { CaseEvidenceClustersCard } from "@/components/case-evidence-clusters-card";
import { CaseIndexWorkspace } from "@/components/case-index-and-evidence";
import { CaseWorkspaceRealtime } from "@/components/case-workspace-realtime";
import { listNotesForCase, listCommentsForCase, listActivity } from "@/services/notes-service";
import { listClusterAnalysesForCase } from "@/services/collaboration-service";
import { buildCommentTree } from "@/lib/comment-threading";
import { CommentThreadView } from "@/components/comment-thread-view";
import { AuthorPersonaLine } from "@/components/author-persona-line";
import { CASE_NOTE_VISIBILITY_LABELS, type CaseNoteVisibility } from "@/types/collaboration";
import { fetchProfilesByIds } from "@/lib/profiles";
import { CaseEvidenceAddPanel } from "@/components/case-evidence-add-panel";
import { CaseNoteForm } from "@/components/case-note-form";
import { InviteForm } from "@/components/invite-form";
import { InvestigationActionsPanel } from "@/components/investigation-actions-panel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { CaseRecordMetaLine } from "@/components/case-record-meta-line";
import { EditCaseDetailsCard } from "@/components/edit-case-details-card";
import { StartInvestigationButton } from "@/components/start-investigation-button";
import { PutOnHoldButton } from "@/components/put-on-hold-button";
import { directoryPayloadFromCaseRow } from "@/lib/case-directory";
import { userCanEditCaseDetails } from "@/lib/case-metadata-edit";
import { cisCasePage } from "@/lib/cis-case-page-shell";
import { cn } from "@/lib/utils";

export default async function CaseDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const c = await getCaseById(supabase, caseId);
  if (!c) notFound();
  const caseRow = c as CaseRow;

  const [members, evidence, notes, comments, activity, clusters, clusterAnalyses, indexSnapshot] =
    await Promise.all([
      getCaseMembers(supabase, caseId),
      getEvidenceForCase(supabase, caseId),
      listNotesForCase(supabase, caseId),
      listCommentsForCase(supabase, caseId),
      listActivity(supabase, caseId, 30),
      listEvidenceClustersForCase(supabase, caseId),
      listClusterAnalysesForCase(supabase, caseId),
      getCaseIndexSnapshot(supabase, caseId),
    ]);

  const caseDiscussionComments = comments.filter((x) => !x.evidence_file_id);
  const caseCommentRoots = buildCommentTree(
    caseDiscussionComments.map((c) => ({
      id: c.id as string,
      parent_comment_id: (c.parent_comment_id as string | null) ?? null,
      body: c.body as string,
      user_id: c.user_id as string | null,
      created_at: c.created_at as string,
    })),
  );

  const profileIds = [
    ...notes.map((n) => n.user_id as string),
    ...comments.map((x) => x.user_id as string),
    ...activity.map((a) => a.actor_id as string).filter(Boolean),
    ...members.map((m) => m.user_id as string),
  ];
  const profiles = await fetchProfilesByIds(supabase, profileIds);
  const firstEvidenceId = evidence[0]?.id ? String(evidence[0].id) : null;

  const evidenceIds = evidence.map((row) => String(row.id));
  const evidenceRowsForDup = evidence.map((row) => ({
    id: String(row.id),
    content_sha256: (row.content_sha256 as string | null) ?? null,
  }));
  const [membershipCounts, hasAiMap, viewedSet, dupFlags] = await Promise.all([
    getEvidenceCaseMembershipCounts(supabase, evidenceIds),
    getEvidenceHasAiAnalysisMap(supabase, evidenceIds),
    user ? getEvidenceViewedSet(supabase, user.id, evidenceIds) : Promise.resolve(new Set<string>()),
    user
      ? getEvidenceContentDuplicatePeerFlags(supabase, { userId: user.id }, evidenceRowsForDup)
      : Promise.resolve(new Map<string, boolean>()),
  ]);

  const canEditCaseDetails =
    user &&
    userCanEditCaseDetails(
      user.id,
      { created_by: c.created_by as string },
      members.map((m) => ({ user_id: m.user_id as string, role: m.role as string })),
    );

  const evidenceIndexRows = evidence.map((row) => ({
    id: String(row.id),
    case_id: row.case_id != null ? String(row.case_id) : null,
    case_membership_count: membershipCounts.get(String(row.id)) ?? 0,
    has_ai_analysis: hasAiMap.get(String(row.id)) ?? false,
    viewed: user ? viewedSet.has(String(row.id)) : false,
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
    created_at: row.created_at != null ? String(row.created_at) : undefined,
    source_type: row.source_type != null ? String(row.source_type) : null,
    source_platform: row.source_platform != null ? String(row.source_platform) : null,
    source_program: row.source_program != null ? String(row.source_program) : null,
    source_url: row.source_url != null ? String(row.source_url) : null,
    suggested_evidence_kind:
      row.suggested_evidence_kind != null ? String(row.suggested_evidence_kind) : "document",
    confirmed_evidence_kind: row.confirmed_evidence_kind != null ? String(row.confirmed_evidence_kind) : null,
  }));

  const panelCard = cn(cisCasePage.panel);
  const panelHeader = cn("pb-3", cisCasePage.panelHeaderBorder);

  return (
    <div className={cn(cisCasePage.canvas, "space-y-8 border-l border-[#1e2d42] pl-4 sm:pl-5")}>
      <CaseWorkspaceRealtime caseId={caseId} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">
            <Link href="/cases" className={cn(cisCasePage.breadcrumbLink, "hover:underline")}>
              Cases
            </Link>
          </p>
          <h1 className={cn(cisCasePage.pageTitleLayout, "mt-1")}>{c.title}</h1>
          <CaseRecordMetaLine caseRow={caseRow} />
          {c.description ? (
            <div className="mt-2 max-w-2xl">
              <p className="text-xs font-medium text-slate-500">Case notes</p>
              <p className="whitespace-pre-wrap text-slate-200">{c.description}</p>
            </div>
          ) : null}
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-slate-400">
            Shared investigation in this workspace. Uploading evidence <em className="text-slate-300">to this case</em>,
            case notes, and threaded comments require sign-in: Supabase Row Level Security only grants those writes to
            authenticated members, and your account id is stored for audit. Guests can still use the separate evidence
            library when it is enabled.
          </p>

          <div className="mt-6 max-w-2xl">
            <EditCaseDetailsCard
              caseId={caseId}
              canEdit={Boolean(canEditCaseDetails)}
              initial={{
                title: caseRow.title,
                description: caseRow.description ?? "",
                ...directoryPayloadFromCaseRow(caseRow),
              }}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {!c.investigation_started_at ? (
            <StartInvestigationButton
              caseId={caseId}
              className="h-8 border border-blue-600 bg-[#1e40af] text-white shadow-none hover:bg-blue-600"
            />
          ) : (
            <PutOnHoldButton caseId={caseId} className={cisCasePage.outlineBtn} />
          )}
          <Button variant="outline" size="sm" asChild className={cn("h-8", cisCasePage.outlineBtn)}>
            <Link href={`/cases/${caseId}/entities`}>Entities</Link>
          </Button>
          <Button variant="outline" size="sm" asChild className={cn("h-8", cisCasePage.outlineBtn)}>
            <Link href={`/cases/${caseId}/timelines`}>Timelines</Link>
          </Button>
          <Button variant="outline" size="sm" asChild className={cn("h-8", cisCasePage.outlineBtn)}>
            <Link href={`/cases/${caseId}/timeline`}>Timeline</Link>
          </Button>
          <Button variant="outline" size="sm" asChild className={cn("h-8", cisCasePage.outlineBtn)}>
            <Link href={`/cases/${caseId}/workspace`}>Case Workspace</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-[minmax(0,1fr)_400px] xl:items-start">
        <div className="min-w-0 space-y-10 xl:order-1 order-2">
      <CaseIndexWorkspace
        caseId={caseId}
        snapshot={indexSnapshot}
        evidence={evidenceIndexRows}
        evidenceUploadSlot={<CaseEvidenceAddPanel caseId={caseId} />}
        allowBulkActions={Boolean(user)}
      />

      <CaseEvidenceClustersCard
        caseId={caseId}
        clusters={clusters}
        analysisByClusterId={clusterAnalyses}
      />

            <div className="grid gap-8 lg:grid-cols-2">
              <Card className={panelCard}>
                <CardHeader className={panelHeader}>
                  <CardTitle className={cisCasePage.cardTitle}>Members</CardTitle>
                  <CardDescription className={cisCasePage.cardDescription}>
                    Roles: owner, admin, contributor, viewer.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {members.map((m) => (
                      <li key={m.id} className="flex justify-between gap-2 text-sm text-slate-200">
                        <span className="inline-flex min-w-0 items-center gap-2">
                          <span className="relative inline-flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#1e2d42] bg-[#0f1623] text-[10px] font-semibold uppercase text-slate-200">
                            {(profiles[m.user_id as string]?.display_name ?? m.user_id ?? "?").slice(0, 1)}
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#141e2e] ${
                                (m.investigator_presence ?? "active") === "away" ? "bg-red-600" : "bg-emerald-500"
                              }`}
                            />
                          </span>
                          <span className="truncate">{profiles[m.user_id as string]?.display_name ?? m.user_id}</span>
                        </span>
                        <span className="shrink-0 text-slate-400">{m.role}</span>
                      </li>
                    ))}
                  </ul>
                  <Separator className="my-6 border-[#1e2d42]/90" />
                  <h3 className="mb-2 text-sm font-medium text-slate-200">Invite collaborator</h3>
                  <InviteForm caseId={caseId} variant="cisCase" />
                </CardContent>
              </Card>
            </div>

            <Card id="case-notes" className={panelCard}>
              <CardHeader className={panelHeader}>
                <CardTitle className={cisCasePage.cardTitle}>Case notes</CardTitle>
                <CardDescription className={cisCasePage.cardDescription}>
                  Notes attached to this case (not a specific file).
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <CaseNoteForm caseId={caseId} caseIsPublic variant="cisCase" />
                {notes.length === 0 ? (
                  <p className="text-sm text-slate-500">No case notes yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {notes.map((n) => {
                      const vis = ((n.visibility as CaseNoteVisibility | undefined) ?? "shared_case") as CaseNoteVisibility;
                      return (
                        <li key={n.id} className={cisCasePage.noteListItem}>
                          <p className="mb-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                              <AuthorPersonaLine
                                profile={profiles[n.user_id as string]}
                                fallbackId={n.user_id as string}
                              />
                              <span className="text-slate-500">{new Date(n.created_at as string).toLocaleString()}</span>
                            </span>
                            <span className={cisCasePage.noteVisibilityBadge}>{CASE_NOTE_VISIBILITY_LABELS[vis]}</span>
                          </p>
                          <p className="whitespace-pre-wrap text-slate-200">{n.body as string}</p>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card className={panelCard}>
              <CardHeader className={panelHeader}>
                <CardTitle className={cisCasePage.cardTitle}>Discussion</CardTitle>
                <CardDescription className={cisCasePage.cardDescription}>
                  Threaded comments on this case (not tied to a single evidence file).
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CommentThreadView
                  caseId={caseId}
                  evidenceFileId={null}
                  roots={caseCommentRoots}
                  profilesById={profiles}
                  variant="cisCase"
                />
              </CardContent>
            </Card>

            <Card className={panelCard}>
              <CardHeader className={panelHeader}>
                <CardTitle className={cisCasePage.cardTitle}>Activity</CardTitle>
                <CardDescription className={cisCasePage.cardDescription}>Recent actions on this case.</CardDescription>
              </CardHeader>
              <CardContent>
                {activity.length === 0 ? (
                  <p className="text-sm text-slate-500">No activity recorded yet.</p>
                ) : (
                  <ul className="space-y-2 text-sm text-slate-300">
                    {activity.map((a) => (
                      <li key={a.id} className="flex gap-2">
                        <span className="shrink-0 text-slate-500">
                          {new Date(a.created_at as string).toLocaleString()}
                        </span>
                        <span>
                          <strong className="text-white">
                            {a.actor_id
                              ? (profiles[a.actor_id as string]?.display_name ??
                                  (a.actor_label as string | null) ??
                                  a.actor_id)
                              : ((a.actor_label as string | null) ?? "Analyst")}
                          </strong>{" "}
                          {a.action as string}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
        </div>

        <aside className="xl:sticky xl:top-6 xl:self-start w-full min-w-0 xl:order-2 order-1">
          <InvestigationActionsPanel
            caseId={caseId}
            firstEvidenceId={firstEvidenceId}
            hasEvidence={evidence.length > 0}
          />
        </aside>
      </div>
    </div>
  );
}
