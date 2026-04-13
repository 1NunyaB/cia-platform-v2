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

export default async function CaseDetailPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const c = await getCaseById(supabase, caseId);
  if (!c) notFound();

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
      author_id: c.author_id as string | null,
      created_at: c.created_at as string,
    })),
  );

  const profileIds = [
    ...notes.map((n) => n.author_id as string),
    ...comments.map((x) => x.author_id as string),
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
  }));

  return (
    <div className="space-y-8">
      <CaseWorkspaceRealtime caseId={caseId} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href="/cases" className="hover:underline">
              Cases
            </Link>
          </p>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">{c.title}</h1>
          <CaseRecordMetaLine caseRow={c as CaseRow} />
          {c.description ? <p className="mt-2 max-w-2xl text-foreground">{c.description}</p> : null}
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-foreground">
            Shared investigation in this workspace. Uploading evidence <em>to this case</em>, case notes, and threaded
            comments require sign-in: Supabase Row Level Security only grants those writes to authenticated members, and
            your account id is stored for audit. Guests can still use the separate evidence library when it is enabled.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/cases/${caseId}/entities`}>Entities</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/cases/${caseId}/timelines`}>Timelines</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/cases/${caseId}/timeline`}>Timeline</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_400px] gap-8 xl:items-start">
        <div className="space-y-10 min-w-0 xl:order-1 order-2">
      <CaseIndexWorkspace
        caseId={caseId}
        snapshot={indexSnapshot}
        evidence={evidenceIndexRows}
        evidenceUploadSlot={<CaseEvidenceAddPanel caseId={caseId} />}
      />

      <CaseEvidenceClustersCard
        caseId={caseId}
        clusters={clusters}
        analysisByClusterId={clusterAnalyses}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>Roles: owner, admin, contributor, viewer.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {members.map((m) => (
                <li key={m.id} className="flex justify-between text-sm">
                  <span>{profiles[m.user_id as string]?.display_name ?? m.user_id}</span>
                  <span className="text-muted-foreground">{m.role}</span>
                </li>
              ))}
            </ul>
            <Separator className="my-6" />
            <h3 className="text-sm font-medium mb-2">Invite collaborator</h3>
            <InviteForm caseId={caseId} />
          </CardContent>
        </Card>
      </div>

      <Card id="case-notes">
        <CardHeader>
          <CardTitle>Case notes</CardTitle>
          <CardDescription>Notes attached to this case (not a specific file).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <CaseNoteForm caseId={caseId} caseIsPublic />
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No case notes yet.</p>
          ) : (
            <ul className="space-y-3">
              {notes.map((n) => {
                const vis = ((n.visibility as CaseNoteVisibility | undefined) ?? "shared_case") as CaseNoteVisibility;
                return (
                  <li key={n.id} className="rounded-md border p-3 text-sm">
                    <p className="text-xs text-muted-foreground mb-1 flex flex-wrap gap-2 items-center">
                      <span className="flex flex-wrap items-center gap-1.5 min-w-0">
                        <AuthorPersonaLine
                          profile={profiles[n.author_id as string]}
                          fallbackId={n.author_id as string}
                        />
                        <span className="text-muted-foreground/70">
                          {new Date(n.created_at as string).toLocaleString()}
                        </span>
                      </span>
                      <span className="rounded border border-zinc-700 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {CASE_NOTE_VISIBILITY_LABELS[vis]}
                      </span>
                    </p>
                    <p className="whitespace-pre-wrap">{n.body as string}</p>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Discussion</CardTitle>
          <CardDescription>Threaded comments on this case (not tied to a single evidence file).</CardDescription>
        </CardHeader>
        <CardContent>
          <CommentThreadView
            caseId={caseId}
            evidenceFileId={null}
            roots={caseCommentRoots}
            getProfile={(id) => (id ? profiles[id] : undefined)}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Activity</CardTitle>
          <CardDescription>Recent actions on this case.</CardDescription>
        </CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {activity.map((a) => (
                <li key={a.id} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">
                    {new Date(a.created_at as string).toLocaleString()}
                  </span>
                  <span>
                    <strong>
                      {a.actor_id
                        ? (profiles[a.actor_id as string]?.display_name ?? (a.actor_label as string | null) ?? a.actor_id)
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
