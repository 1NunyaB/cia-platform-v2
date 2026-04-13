import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getEvidenceById,
  getExtractedText,
  getAiAnalysis,
  getEvidenceNeedsExtraction,
  listEvidenceVisualTags,
  isEvidenceCaseMembershipTableError,
} from "@/services/evidence-service";
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
import { ProcessingBadge } from "@/components/processing-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { listEvidenceLinksForEvidence } from "@/services/case-investigation-query";
import { runEvidenceIntelligenceOnOpen } from "@/services/evidence-intelligence-service";
import { EvidenceIntelligencePanel } from "@/components/evidence-intelligence-panel";
import type { EvidenceIntelligenceResult } from "@/types/evidence-intelligence";
import type { AiAnalysis, EvidenceProcessingStatus } from "@/types";
import type { ClusterAnalysisView } from "@/types/analysis";
import { EVIDENCE_SOURCE_TYPE_LABELS, type EvidenceSourceType } from "@/lib/evidence-source";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";
import { CopyInlineButton } from "@/components/copy-inline-button";
import { ShareEvidenceToCaseDialog } from "@/components/share-evidence-to-case";
import { EvidenceTextSelectionSearch } from "@/components/evidence-text-selection-search";
import { isExtractionPlaceholderText } from "@/lib/extraction-messages";
import { EvidenceFilePreview } from "@/components/evidence-file-preview";
import { EvidenceProcessingCallout } from "@/components/evidence-processing-callout";
import { RecordEvidenceView } from "@/components/record-evidence-view";
import { EvidenceWorkflowStatusCard } from "@/components/evidence-workflow-status-card";
import { isPlatformDeleteAdmin } from "@/lib/admin-guard";

/** Shown when user arrives from Investigation Actions (?intent=) — same structured pipeline; copy stays conservative. */
const INVESTIGATION_INTENT_MESSAGES: Record<string, string> = {
  explain_relevance:
    "You opened this file from Investigation Actions. Use “Run AI analysis” below for the seven-field structured finding (relevance appears in Evidence Basis and Reasoning).",
  redactions:
    "Redaction-focused review: use Run AI analysis below. The structured finding and Redaction analysis panel require cautious labels — no exact recovery of hidden text; see limitations and context warning.",
  interpret_cautious:
    "Cautious interpretation: expect Inferred or Uncertain when appropriate. Run analysis below.",
  code_words:
    "Pattern and phrasing review uses the same structured analysis on extracted text. Run analysis below.",
  contradictions:
    "Compare structured findings with your notes; an automated contradiction matrix is planned.",
  summarize:
    "Summarization uses the same structured finding fields. Run analysis below.",
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

  const [extracted, analysis, notes, crossLinks, stickyBundles, evidenceComments, needsManualExtraction, visualTags] =
    await Promise.all([
      getExtractedText(supabase, evidenceId),
      getAiAnalysis(supabase, evidenceId),
      listNotesForEvidence(supabase, caseId, evidenceId),
      listEvidenceLinksForEvidence(supabase, caseId, evidenceId),
      listStickyNotesWithReplies(supabase, evidenceId),
      listCommentsForEvidence(supabase, caseId, evidenceId),
      getEvidenceNeedsExtraction(supabase, evidenceId),
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
    author_id: c.author_id as string | null,
    created_at: c.created_at as string,
  }));
  const commentRoots = buildCommentTree(commentFlat);

  const authorIds = [
    ...notes.map((n) => n.author_id as string),
    ...stickyBundles.flatMap((b) => [
      b.sticky.author_id,
      ...b.replies.map((r) => r.author_id),
    ]),
    ...evidenceComments.map((c) => c.author_id as string),
  ].filter(Boolean) as string[];
  const profiles = await fetchProfilesByIds(supabase, [...new Set(authorIds)]);
  const getProfile = (id: string | null) => (id ? profiles[id] : undefined);

  const displayTitle = evidencePrimaryLabel({
    display_filename: ev.display_filename ?? null,
    original_filename: ev.original_filename,
  });
  const shortAlias = ev.short_alias?.trim();

  const rawExtracted = extracted?.raw_text != null ? String(extracted.raw_text) : "";
  const extractionStatus = String((ev as { extraction_status?: string | null }).extraction_status ?? "pending").toLowerCase();
  const hasDisplayableText =
    extractionStatus === "ok" && rawExtracted.length > 0 && !isExtractionPlaceholderText(rawExtracted);
  const hasAnalysis = Boolean(analysis);
  const ps = ev.processing_status as EvidenceProcessingStatus;
  const showProcessingCallout =
    (ps === "error" && ev.error_message) ||
    ((ps === "accepted" || ps === "extracting") && !hasDisplayableText);

  return (
    <div className="space-y-8 max-w-4xl">
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
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{displayTitle}</h1>
          <ProcessingBadge status={ev.processing_status as EvidenceProcessingStatus} />
        </div>
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

      <div className="space-y-2">
        <p className="text-xs leading-relaxed text-foreground">
          Previews use short-lived in-app access only. There is no permanent public URL for this file. Screenshots and
          copying can still occur on a user&apos;s device — this UI does not claim to block that.
        </p>
        <EvidenceFilePreview evidenceId={evidenceId} />
      </div>

      {showProcessingCallout ? (
        <EvidenceProcessingCallout status={ps} errorMessage={ev.error_message as string | null | undefined} />
      ) : null}

      <EvidenceWorkflowStatusCard
        processingStatus={ps}
        extractionStatus={(ev as { extraction_status?: string | null }).extraction_status}
        hasDisplayableExtract={hasDisplayableText}
        hasAnalysis={hasAnalysis}
        needsExtraction={needsManualExtraction}
        evidenceId={evidenceId}
      />

      {user ? (
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-foreground">Also use in another investigation</CardTitle>
            <CardDescription>
              Link the same file to another case you can edit. Ranked by overlap with titles, entities, aliases,
              timeline years, clusters, and source metadata. No public link or export is created.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ShareEvidenceToCaseDialog evidenceId={evidenceId} excludeCaseId={caseId} />
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Source metadata</CardTitle>
          <CardDescription>Captured at upload for the case index and source filters.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-foreground">
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
        </CardContent>
      </Card>

      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Image evidence and visual tags</CardTitle>
          <CardDescription>
            Photo-first images may have limited OCR; visual object/feature tags support image evidence search.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-foreground">
          <p>
            <span className="text-muted-foreground">Classification: </span>
            {extractionStatus === "limited" || extractionStatus === "low_confidence"
              ? "Image evidence / photo-first"
              : "Text-first or mixed"}
          </p>
          {!visualTags.length ? (
            <p className="text-muted-foreground">No visual tags detected yet.</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {visualTags.map((t) => (
                <li key={`${t.tag}-${t.source ?? "heuristic"}`} className="rounded border border-border bg-panel px-2 py-1">
                  <span className="font-medium text-foreground">{t.tag}</span>
                  {t.confidence != null ? (
                    <span className="ml-1 text-xs text-muted-foreground">{Math.round(t.confidence * 100)}%</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {intelligence ? <EvidenceIntelligencePanel caseId={caseId} intelligence={intelligence} /> : null}

      {intent && INVESTIGATION_INTENT_MESSAGES[intent] ? (
        <Alert className="border-sky-300 bg-sky-50">
          <AlertDescription className="text-sm text-foreground">{INVESTIGATION_INTENT_MESSAGES[intent]}</AlertDescription>
        </Alert>
      ) : intent ? (
        <Alert className="border-border bg-panel">
          <AlertDescription className="text-sm text-foreground">
            Investigation action intent &quot;{intent}&quot; — use Run AI analysis below for the structured finding format.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-border bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Extracted text</CardTitle>
          <CardDescription>
            AI only sees this text — not your original binary file. Images and scanned PDFs are OCR&apos;d
            server-side after upload; text-based PDFs use the embedded text layer. Status should move Accepted →
            Extracting → Complete unless an error is stored.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasDisplayableText ? (
            <EvidenceTextSelectionSearch caseId={caseId}>
              <pre className="text-xs whitespace-pre-wrap max-h-96 overflow-auto rounded-md border border-document-border bg-document p-4 text-foreground select-text cursor-text">
                {rawExtracted}
              </pre>
            </EvidenceTextSelectionSearch>
          ) : rawExtracted.length > 0 ? (
            <>
              {extractionStatus === "limited" || extractionStatus === "low_confidence" ? (
                <p className="text-sm text-foreground rounded-md border border-sky-300 bg-sky-50 px-3 py-2">
                  This appears to be primarily image/photo evidence. OCR found limited incidental text; manual visual
                  review and zoom may be more useful than document-style extraction.
                </p>
              ) : (
                <p className="text-sm text-foreground rounded-md border border-sky-300 bg-sky-50 px-3 py-2">
                  Stored content is only a system placeholder (no readable text was extracted). Run extraction again or
                  upload a clearer file.
                </p>
              )}
              <pre className="text-xs whitespace-pre-wrap max-h-48 overflow-auto rounded-md border border-document-border bg-document p-4 text-foreground/90">
                {rawExtracted}
              </pre>
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-foreground">
                No extracted text yet. If the file is still processing, wait for Extracting to finish. Use{" "}
                <strong className="font-semibold">Extract now</strong> in Evidence processing above when you are ready.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-white shadow-sm">
        <CardHeader>
          <CardTitle>AI analysis</CardTitle>
          <CardDescription>
            Structured finding: Finding / Answer, Evidence Basis, Confidence, Classification (including Correlated),
            Reasoning, Limitations, Next Step. Runs only on extracted text above; supplemental graph data is
            secondary.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!analysis ? (
            <p className="text-sm text-foreground border border-border rounded-md p-4 bg-panel">
              No analysis has been run yet. Use <strong className="font-semibold">Run AI analysis</strong> in Evidence
              processing after extraction completes.
            </p>
          ) : (
            <EvidenceAnalysisSection analysis={analysis} />
          )}
        </CardContent>
      </Card>

      <Card className="border-border bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Cross-evidence links</CardTitle>
          <CardDescription>Pairwise links and cluster co-membership for this file (case scope).</CardDescription>
        </CardHeader>
        <CardContent>
          {!crossLinks.length ? (
            <p className="text-sm text-muted-foreground">
              No explicit links yet. Run analysis with cross-file hints, or add links in a future workflow.
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
        </CardContent>
      </Card>

      <Card className="border-border bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Evidence discussion</CardTitle>
          <CardDescription>
            Collaboration follows this file: related clusters, sticky notes, and threaded comments load here
            automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
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
              getProfile={getProfile}
            />
          </div>
          <Separator className="bg-border" />
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Threaded comments</h3>
            <CommentThreadView
              caseId={caseId}
              evidenceFileId={evidenceId}
              roots={commentRoots}
              getProfile={getProfile}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-border bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Formal notes on this file</CardTitle>
          <CardDescription>Case-record notes attached to this evidence item (distinct from sticky notes).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
                      profile={getProfile(n.author_id as string | null)}
                      fallbackId={n.author_id as string | null}
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
          display — re-run analysis to refresh structured data end-to-end.
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
