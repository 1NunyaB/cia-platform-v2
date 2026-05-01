import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getEvidenceById,
  getAiAnalysis,
  listEvidenceLinkedCaseIds,
  listEvidenceVisualTags,
  isEvidenceCaseMembershipTableError,
} from "@/services/evidence-service";
import { listCasesForUser } from "@/services/case-service";
import { listNotesForEvidence, listCommentsForEvidence } from "@/services/notes-service";
import { listStickyNotesWithReplies } from "@/services/collaboration-service";
import {
  listEvidenceClustersContainingEvidence,
} from "@/services/case-investigation-query";
import { listClusterAnalysesForCase } from "@/services/collaboration-service";
import { buildCommentTree } from "@/lib/comment-threading";
import { CommentThreadView } from "@/components/comment-thread-view";
import { EvidenceStickyNotesPanel } from "@/components/evidence-sticky-notes-panel";
import { fetchProfilesByIds } from "@/lib/profiles";
import { AuthorPersonaLine } from "@/components/author-persona-line";
import { resolveAnalysisPresentation } from "@/lib/analysis-parsing";
import { AnalysisFindingPanel } from "@/components/analysis-finding-panel";
import { ConcealedLanguagePanel } from "@/components/concealed-language-panel";
import { MediaAnalysisPanel } from "@/components/media-analysis-panel";
import { RedactionAnalysisPanel } from "@/components/redaction-analysis-panel";
import { AnalysisSupplementalPanel } from "@/components/analysis-supplemental-panel";
import { CaseNoteForm } from "@/components/case-note-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { listEvidenceLinksForEvidence } from "@/services/case-investigation-query";
import { runEvidenceIntelligenceOnOpen } from "@/services/evidence-intelligence-service";
import { EvidenceIntelligencePanel } from "@/components/evidence-intelligence-panel";
import type { EvidenceIntelligenceResult } from "@/types/evidence-intelligence";
import type { AiAnalysis, EvidenceFile, EvidenceProcessingStatus } from "@/types";
import type { ClusterAnalysisView } from "@/types/analysis";
import { EVIDENCE_SOURCE_TYPE_LABELS, type EvidenceSourceType } from "@/lib/evidence-source";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";
import { CopyInlineButton } from "@/components/copy-inline-button";
import { ShareEvidenceToCaseDialog } from "@/components/share-evidence-to-case";
import { EvidenceInlinePreviewCard } from "@/components/evidence-inline-preview-card";
import { EvidenceKindPanel } from "@/components/evidence-kind-panel";
import { RecordEvidenceView } from "@/components/record-evidence-view";
import { EvidenceWorkflowStatusCard } from "@/components/evidence-workflow-status-card";
import { isPlatformDeleteAdmin } from "@/lib/admin-guard";
import { EvidenceDeleteButton } from "@/components/evidence-delete-button";
import { EvidenceLocationGeoPanel } from "@/components/evidence-location-geo-panel";
import { LinkedCasesControl } from "@/components/linked-cases-control";

/** Shown when user arrives from Investigation Actions (?intent=) — same structured pipeline; copy stays conservative. */
const INVESTIGATION_INTENT_MESSAGES: Record<string, string> = {
  explain_relevance:
    "You opened this file from Investigation Actions. Use File view above for close inspection; structured analysis (if present) appears below.",
  redactions:
    "Redaction-focused review: inspect the file in File view above. Any stored analysis panels below use cautious labels — no exact recovery of hidden text.",
  interpret_cautious:
    "Cautious interpretation: expect Inferred or Uncertain when appropriate in any analysis shown below.",
  code_words:
    "Pattern and phrasing review: use File view and your notes; cross-file linking may appear below when present.",
  contradictions:
    "Compare your notes with any analysis below; an automated contradiction matrix is planned.",
  summarize:
    "Summaries may appear in structured analysis fields below when a prior analysis run exists.",
};

export default async function EvidenceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string; evidenceId: string }>;
  searchParams: Promise<{ intent?: string }>;
}) {
  const { caseId, evidenceId } = await params;
  const { intent } = await searchParams;
  const supabase = await createClient();

  const ev = await getEvidenceById(supabase, evidenceId);
  if (!ev) notFound();
  const membershipRes = await supabase
    .from("evidence_case_memberships")
    .select("evidence_file_id")
    .eq("evidence_file_id", evidenceId)
    .eq("case_id", caseId)
    .maybeSingle();

  const belongs =
    ev.case_id === caseId ||
    (!membershipRes.error && membershipRes.data != null) ||
    (isEvidenceCaseMembershipTableError(membershipRes.error) && ev.case_id === caseId);
  if (!belongs) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [allCasesForLinks, linkedCaseIds] = await Promise.all([
    user ? listCasesForUser(supabase, user.id) : Promise.resolve([]),
    listEvidenceLinkedCaseIds(supabase, evidenceId).catch(() => [] as string[]),
  ]);
  const canManageCaseLinks = Boolean(user && (ev.uploaded_by as string | null) === user.id);

  const [analysis, notes, crossLinks, stickyBundles, evidenceComments, visualTags] = await Promise.all([
    getAiAnalysis(supabase, evidenceId),
    listNotesForEvidence(supabase, caseId, evidenceId),
    listEvidenceLinksForEvidence(supabase, caseId, evidenceId),
    listStickyNotesWithReplies(supabase, evidenceId),
    listCommentsForEvidence(supabase, caseId, evidenceId),
    listEvidenceVisualTags(supabase, evidenceId),
  ]);

  let intelligence: EvidenceIntelligenceResult | null = null;
  try {
    intelligence = await runEvidenceIntelligenceOnOpen(supabase, {
      caseId,
      evidenceId,
      userId: user?.id ?? null,
    });
  } catch (e) {
    console.error("[evidence page] intelligence pass failed:", e);
  }

  const [relatedClusters, clusterAnalyses] = await Promise.all([
    listEvidenceClustersContainingEvidence(supabase, caseId, evidenceId),
    listClusterAnalysesForCase(supabase, caseId),
  ]);

  const commentFlat = evidenceComments.map((c) => ({
    id: c.id as string,
    parent_comment_id: (c.parent_comment_id as string | null) ?? null,
    body: c.body as string,
    user_id: c.user_id as string | null,
    created_at: c.created_at as string,
  }));
  const commentRoots = buildCommentTree(commentFlat);

  const authorIds = [
    ...notes.map((n) => n.user_id as string),
    ...stickyBundles.flatMap((b) => [
      b.sticky.user_id,
      ...b.replies.map((r) => r.user_id),
    ]),
    ...evidenceComments.map((c) => c.user_id as string),
  ].filter(Boolean) as string[];
  const profiles = await fetchProfilesByIds(supabase, [...new Set(userIds)]);

  const displayTitle = evidencePrimaryLabel({
    display_filename: ev.display_filename ?? null,
    original_filename: ev.original_filename,
  });
  const shortAlias = ev.short_alias?.trim();

  const ps = ev.processing_status as EvidenceProcessingStatus;
  const derivedFromId = (ev as { derived_from_evidence_id?: string | null }).derived_from_evidence_id ?? null;
  let provenanceFromOriginal: { href: string; label: string } | null = null;
  if (derivedFromId) {
    const rootEv = await getEvidenceById(supabase, derivedFromId);
    if (rootEv) {
      const rootCaseId = rootEv.case_id as string | null;
      provenanceFromOriginal = {
        href: rootCaseId ? `/cases/${rootCaseId}/evidence/${derivedFromId}` : `/evidence/${derivedFromId}`,
        label: evidencePrimaryLabel({
          display_filename: rootEv.display_filename ?? null,
          original_filename: rootEv.original_filename,
        }),
      };
    }
  }

  const mime = String((ev.mime_type as string | null) ?? "");
  const showImageEvidenceBlock = mime.toLowerCase().startsWith("image/");

  return (
    <div className="space-y-6 max-w-4xl">
      {user ? <RecordEvidenceView evidenceId={evidenceId} /> : null}
      <div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <Link href={`/cases/${caseId}`} className="text-foreground hover:underline">
            ← Case
          </Link>
          <Link
            href={`/evidence/compare?a=${encodeURIComponent(evidenceId)}`}
            className="text-foreground hover:underline"
          >
            Compare with another file
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{displayTitle}</h1>
        <div className="mt-2 space-y-1.5 text-sm">
          <p>
            <span className="text-muted-foreground">Original upload name: </span>
            <span className="text-foreground">{ev.original_filename}</span>
          </p>
          {shortAlias ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Short alias: </span>
              <code className="rounded border border-document-border bg-document px-2 py-0.5 text-xs font-mono text-foreground">
                {shortAlias}
              </code>
              <CopyInlineButton text={shortAlias} label="Copy short alias (in-app ID)" />
            </div>
          ) : null}
          {ev.file_sequence_number != null ? (
            <p className="text-xs text-muted-foreground">Case file #{String(ev.file_sequence_number).padStart(3, "0")}</p>
          ) : null}
        </div>
      </div>

      <EvidenceInlinePreviewCard
        evidenceId={evidenceId}
        caseId={caseId}
        showCropToolbar={Boolean(user)}
        mimeType={ev.mime_type as string | null}
      />

      <EvidenceKindPanel evidenceId={evidenceId} row={ev} canEdit={Boolean(user)} />

      {user && (ev as EvidenceFile).image_category === "location" ? (
        <EvidenceLocationGeoPanel
          evidenceId={evidenceId}
          initialLatitude={(ev as EvidenceFile).latitude ?? null}
          initialLongitude={(ev as EvidenceFile).longitude ?? null}
        />
      ) : null}

      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="space-y-0 px-3 py-2 pb-1">
          <CardTitle className="text-sm font-semibold">Evidence status</CardTitle>
          <CardDescription className="text-[11px] leading-snug text-muted-foreground">
            Sharing, stacks, and quick actions — file preview is above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 px-3 py-2 pb-3">
          <EvidenceWorkflowStatusCard
            processingStatus={ps}
            evidenceId={evidenceId}
            uploadHref={`/cases/${caseId}/evidence/add`}
            evidenceDisplayLabel={displayTitle}
            caseIdForWorkspaceAi={caseId}
            processingErrorMessage={(ev.error_message as string | null | undefined) ?? null}
            assignControl={
              user ? <ShareEvidenceToCaseDialog evidenceId={evidenceId} excludeCaseId={caseId} /> : undefined
            }
            linkedCasesControl={
              user ? (
                <LinkedCasesControl
                  evidenceId={evidenceId}
                  cases={allCasesForLinks.map((c) => ({
                    id: c.id as string,
                    title: (c.title as string) ?? "Untitled",
                  }))}
                  initialLinkedCaseIds={linkedCaseIds}
                  canManage={canManageCaseLinks}
                  contextCaseId={caseId}
                />
              ) : undefined
            }
            deleteControl={
              user && isPlatformDeleteAdmin(user) ? (
                <EvidenceDeleteButton evidenceId={evidenceId} redirectTo={`/cases/${caseId}`} />
              ) : undefined
            }
          />
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Details &amp; collaboration</CardTitle>
          <CardDescription>Source metadata, optional prior analysis, links, notes, and discussion.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-4 text-foreground">
          <p className="text-xs leading-relaxed text-foreground">
            Previews use short-lived in-app access only. There is no permanent public URL for this file. Screenshots and
            copying can still occur on a user&apos;s device — this UI does not claim to block that.
          </p>
          {provenanceFromOriginal ? (
            <p className="rounded-md border border-border bg-panel px-2.5 py-2 text-xs text-foreground">
              <span className="font-semibold text-foreground">Provenance: </span>
              Cropped or edited derivative linked to original{" "}
              <Link href={provenanceFromOriginal.href} className="font-medium text-blue-900 underline underline-offset-2">
                {provenanceFromOriginal.label}
              </Link>
              .
            </p>
          ) : null}
          <p>
            <span className="text-muted-foreground">Type: </span>
            {EVIDENCE_SOURCE_TYPE_LABELS[(ev.source_type as EvidenceSourceType) ?? "unknown"] ?? String(ev.source_type ?? "unknown")}
          </p>
          {ev.source_platform ? (
            <p>
              <span className="text-muted-foreground">Platform / network: </span>
              {String(ev.source_platform)}
            </p>
          ) : null}
          {ev.source_program ? (
            <p>
              <span className="text-muted-foreground">Program / title: </span>
              {String(ev.source_program)}
            </p>
          ) : null}
          {ev.source_url ? (
            <div className="space-y-1">
              <p>
                <span className="text-muted-foreground">Original source URL: </span>
                <a
                  href={String(ev.source_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all font-medium text-foreground underline underline-offset-2 hover:text-primary"
                >
                  {String(ev.source_url)}
                </a>
              </p>
              <p className="text-xs leading-snug text-foreground">
                This points to where the material was obtained; it is not a share link for the uploaded file. File access
                stays inside this app for authorized users.
              </p>
            </div>
          ) : null}
          {showImageEvidenceBlock ? (
            <div className="rounded-md border-2 border-sky-800/50 bg-sky-50 px-2.5 py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-sky-950">Image</p>
              <p className="mt-1 text-[11px] font-medium leading-snug text-sky-950">
                Use <strong className="font-semibold">File view</strong> above to zoom in and crop or save an edited copy
                (new file <span className="font-mono">__0001</span>, <span className="font-mono">__0002</span>, … linked to
                the root original).
              </p>
              {visualTags.length ? (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {visualTags.map((t) => (
                    <li
                      key={`${t.tag}-${t.source ?? "heuristic"}`}
                      className="rounded border border-sky-800/30 bg-white px-2 py-1"
                    >
                      <span className="font-medium text-foreground">{t.tag}</span>
                      {t.confidence != null ? (
                        <span className="ml-1 text-xs text-muted-foreground">{Math.round(t.confidence * 100)}%</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-xs font-semibold text-sky-950">No visual tags on file.</p>
              )}
            </div>
          ) : (
            <p>
              <span className="text-muted-foreground">Media type: </span>
              <span className="text-foreground">{mime || "unknown"}</span>
            </p>
          )}
          {!analysis ? (
            <p className="text-sm text-foreground border border-border rounded-md p-4 bg-panel">
              No structured analysis record on this file. Prior runs (if any) are not shown here.
            </p>
          ) : (
            <EvidenceAnalysisSection analysis={analysis} />
          )}
          {intelligence ? <EvidenceIntelligencePanel caseId={caseId} intelligence={intelligence} /> : null}
          {intent && INVESTIGATION_INTENT_MESSAGES[intent] ? (
            <Alert className="border-sky-300 bg-sky-50">
              <AlertDescription className="text-sm text-foreground">{INVESTIGATION_INTENT_MESSAGES[intent]}</AlertDescription>
            </Alert>
          ) : intent ? (
            <Alert className="border-border bg-panel">
              <AlertDescription className="text-sm text-foreground">
                Investigation action intent &quot;{intent}&quot; — use File view above and any analysis sections below.
              </AlertDescription>
            </Alert>
          ) : null}
          {!crossLinks.length ? (
            <p className="text-sm text-muted-foreground">
              No explicit cross-file links yet. Links may be added in a future workflow.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {crossLinks.map(({ link, otherId, otherFilename }) => (
                <li key={link.id} className="flex flex-wrap items-baseline gap-2 border border-border rounded-md px-3 py-2 bg-panel">
                  <span className="text-xs text-muted-foreground">{link.link_type}</span>
                  <Link
                    href={`/cases/${caseId}/evidence/${otherId}`}
                    className="text-blue-800 font-medium hover:underline"
                  >
                    {otherFilename}
                  </Link>
                  {link.description ? (
                    <span className="text-xs text-muted-foreground w-full">{link.description}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <Separator className="bg-border" />
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Related clusters</h3>
            {!relatedClusters.length ? (
              <p className="text-sm text-muted-foreground">This file is not in any cluster yet.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {relatedClusters.map((cl) => (
                  <li key={cl.id} className="rounded-md border border-border px-3 py-2 bg-panel">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-foreground font-medium">{cl.title ?? "Cluster"}</span>
                      {cl.cluster_kind ? (
                        <span className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
                          {String(cl.cluster_kind).replace(/_/g, " ")}
                        </span>
                      ) : null}
                      <span className="text-[10px] text-muted-foreground">
                        {cl.evidence_cluster_members?.length ?? 0} linked evidence
                      </span>
                    </div>
                    {cl.rationale ? (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cl.rationale}</p>
                    ) : null}
                    <ClusterConclusionNote analysis={clusterAnalyses[cl.id] ?? null} />
                    <Link
                      href={`/cases/${caseId}/clusters/${cl.id}`}
                      className="text-xs text-blue-800 font-medium hover:underline mt-1 inline-block"
                    >
                      View full cluster
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Separator className="bg-border" />
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Sticky notes</h3>
            <EvidenceStickyNotesPanel
              caseId={caseId}
              evidenceId={evidenceId}
              currentUserId={user?.id ?? null}
              currentUserCanDelete={isPlatformDeleteAdmin(user)}
              initial={stickyBundles}
              profilesById={profiles}
            />
          </div>
          <Separator className="bg-border" />
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Threaded comments</h3>
            <CommentThreadView
              caseId={caseId}
              evidenceFileId={evidenceId}
              roots={commentRoots}
              profilesById={profiles}
            />
          </div>
          <Separator className="bg-border" />
          <CaseNoteForm caseId={caseId} evidenceFileId={evidenceId} placeholder="Formal note about this file…" />
          <Separator />
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No formal file notes yet.</p>
          ) : (
            <ul className="space-y-3">
              {notes.map((n) => (
                <li key={n.id} className="rounded-md border p-3 text-sm">
                  <p className="text-xs text-muted-foreground mb-1">
                    <AuthorPersonaLine
                      profile={n.user_id ? profiles[n.user_id as string] : undefined}
                      fallbackId={n.user_id as string | null}
                    />{" "}
                    <span className="text-muted-foreground/70">
                      {new Date(n.created_at as string).toLocaleString()}
                    </span>
                  </p>
                  <p className="whitespace-pre-wrap">{n.body as string}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ClusterConclusionNote({ analysis }: { analysis: ClusterAnalysisView | null }) {
  if (!analysis) {
    return (
      <p className="mt-1 text-xs text-muted-foreground">
        <span className="font-semibold text-foreground">Possible conclusion:</span> Cluster conclusion not analyzed yet.
      </p>
    );
  }
  const cls = analysis.finding.classification;
  const confidence = analysis.finding.confidence;
  const strongAuth =
    analysis.authenticityLabel === "verified_by_source" || analysis.authenticityLabel === "strongly_corroborated";
  const strongClass = cls === "Confirmed" || cls === "Conclusive";
  const strongConfidence = confidence === "high" || confidence === "medium";
  const verified = strongAuth && strongClass && strongConfidence;

  return (
    <p className="mt-1 text-xs text-foreground">
      <span
        className={`mr-1.5 inline-flex rounded px-1.5 py-0.5 font-semibold ${
          verified ? "bg-emerald-100 text-emerald-900 border border-emerald-300" : "bg-amber-100 text-amber-900 border border-amber-300"
        }`}
      >
        {verified ? "Verified conclusion" : "Possible conclusion"}
      </span>
      <span className="text-foreground/95">{analysis.finding.finding_answer}</span>
    </p>
  );
}

function EvidenceAnalysisSection({ analysis }: { analysis: AiAnalysis }) {
  const presentation = resolveAnalysisPresentation(analysis);
  return (
    <div className="space-y-6">
      {presentation.isLegacyShell ? (
        <p className="text-sm text-amber-950 border border-amber-300 rounded-md p-3 bg-amber-50">
          This record uses a legacy or partially migrated stored shape. The seven fields below are normalized for
          display only.
        </p>
      ) : null}
      <AnalysisFindingPanel
        finding={presentation.finding}
        authenticityLabel={presentation.authenticityLabel}
        authenticityNotes={presentation.authenticityNotes}
      />
      {presentation.mediaAnalysis ? <MediaAnalysisPanel detail={presentation.mediaAnalysis} /> : null}
      {presentation.redactionAnalysis ? (
        <RedactionAnalysisPanel detail={presentation.redactionAnalysis} />
      ) : null}
      {presentation.concealedLanguageAnalysis ? (
        <ConcealedLanguagePanel detail={presentation.concealedLanguageAnalysis} />
      ) : null}
      <div>
        <h3 className="text-sm font-medium text-foreground mb-2">Supplemental (same model run)</h3>
        <AnalysisSupplementalPanel supplemental={presentation.supplemental} />
      </div>
      <Tabs defaultValue="metadata" className="w-full">
        <TabsList>
          <TabsTrigger value="metadata">Record</TabsTrigger>
          <TabsTrigger value="raw">Structured JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="metadata" className="mt-3 text-xs text-muted-foreground space-y-2">
          <p>Model: {analysis.model ?? "—"}</p>
          <p>Updated: {new Date(analysis.updated_at).toLocaleString()}</p>
          {analysis.redaction_notes ? (
            <p className="text-muted-foreground whitespace-pre-wrap border-t border-border pt-2 mt-2">
              Redaction / sensitivity notes (legacy column): {String(analysis.redaction_notes)}
            </p>
          ) : null}
        </TabsContent>
        <TabsContent value="raw" className="mt-3">
          <pre className="text-xs overflow-auto max-h-64 rounded-md border border-document-border p-4 bg-document text-foreground">
            {JSON.stringify(analysis.structured ?? {}, null, 2)}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}
