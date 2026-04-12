import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEvidenceById, getExtractedText, getAiAnalysis } from "@/services/evidence-service";
import { listNotesForEvidence, listCommentsForEvidence } from "@/services/notes-service";
import { listStickyNotesWithReplies } from "@/services/collaboration-service";
import {
  listEvidenceClustersContainingEvidence,
} from "@/services/case-investigation-query";
import { buildCommentTree } from "@/lib/comment-threading";
import { CommentThreadView } from "@/components/comment-thread-view";
import { EvidenceStickyNotesPanel } from "@/components/evidence-sticky-notes-panel";
import { fetchProfilesByIds } from "@/lib/profiles";
import { resolveAnalysisPresentation } from "@/lib/analysis-parsing";
import { AnalyzeButton } from "@/components/analyze-button";
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
import { EVIDENCE_SOURCE_TYPE_LABELS, type EvidenceSourceType } from "@/lib/evidence-source";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";
import { CopyInlineButton } from "@/components/copy-inline-button";
import { EvidenceTextSelectionSearch } from "@/components/evidence-text-selection-search";

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
  const belongs =
    ev.case_id === caseId ||
    (
      await supabase
        .from("evidence_case_memberships")
        .select("evidence_file_id")
        .eq("evidence_file_id", evidenceId)
        .eq("case_id", caseId)
        .maybeSingle()
    ).data != null;
  if (!belongs) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [extracted, analysis, notes, crossLinks, stickyBundles, evidenceComments] = await Promise.all([
    getExtractedText(supabase, evidenceId),
    getAiAnalysis(supabase, evidenceId),
    listNotesForEvidence(supabase, caseId, evidenceId),
    listEvidenceLinksForEvidence(supabase, caseId, evidenceId),
    listStickyNotesWithReplies(supabase, evidenceId),
    listCommentsForEvidence(supabase, caseId, evidenceId),
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

  const relatedClusters = await listEvidenceClustersContainingEvidence(supabase, caseId, evidenceId);

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
  const authorLabel = (id: string | null) => (id ? profiles[id]?.display_name ?? id : "Analyst");

  const displayTitle = evidencePrimaryLabel({
    display_filename: ev.display_filename ?? null,
    original_filename: ev.original_filename,
  });
  const shortAlias = ev.short_alias?.trim();

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/cases/${caseId}`} className="hover:underline">
            ← Case
          </Link>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{displayTitle}</h1>
          <ProcessingBadge status={ev.processing_status as EvidenceProcessingStatus} />
        </div>
        <div className="mt-2 space-y-1.5 text-sm text-zinc-400">
          <p>
            <span className="text-muted-foreground">Original upload name: </span>
            <span className="text-zinc-200">{ev.original_filename}</span>
          </p>
          {shortAlias ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground">Short alias: </span>
              <code className="rounded border border-zinc-700 bg-zinc-900/80 px-2 py-0.5 text-xs font-mono text-sky-300">
                {shortAlias}
              </code>
              <CopyInlineButton text={shortAlias} label="Copy short alias" />
            </div>
          ) : null}
          {ev.file_sequence_number != null ? (
            <p className="text-xs text-zinc-500">Case file #{String(ev.file_sequence_number).padStart(3, "0")}</p>
          ) : null}
        </div>
        {ev.error_message ? (
          <p className="text-sm text-destructive mt-2">Error: {ev.error_message}</p>
        ) : null}
      </div>

      <Card className="border-zinc-800 bg-zinc-950/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Source metadata</CardTitle>
          <CardDescription>Captured at upload for the case index and source filters.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-zinc-200">
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
            <p>
              <span className="text-muted-foreground">URL: </span>
              <a
                href={String(ev.source_url)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:underline break-all"
              >
                {String(ev.source_url)}
              </a>
            </p>
          ) : null}
        </CardContent>
      </Card>

      {intelligence ? <EvidenceIntelligencePanel caseId={caseId} intelligence={intelligence} /> : null}

      {intent && INVESTIGATION_INTENT_MESSAGES[intent] ? (
        <Alert className="border-sky-500/35 bg-sky-950/25 text-sky-100">
          <AlertDescription className="text-sm">{INVESTIGATION_INTENT_MESSAGES[intent]}</AlertDescription>
        </Alert>
      ) : intent ? (
        <Alert className="border-zinc-600 bg-zinc-950/50">
          <AlertDescription className="text-sm text-foreground">
            Investigation action intent &quot;{intent}&quot; — use Run AI analysis below for the structured finding format.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Extracted text</CardTitle>
          <CardDescription>
            AI only sees this text — not your original binary file. Images and scanned PDFs are OCR&apos;d
            server-side after upload; text-based PDFs use the embedded text layer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {extracted?.raw_text ? (
            <EvidenceTextSelectionSearch caseId={caseId}>
              <pre className="text-xs whitespace-pre-wrap max-h-96 overflow-auto rounded-md border p-4 bg-muted/30 select-text cursor-text">
                {extracted.raw_text as string}
              </pre>
            </EvidenceTextSelectionSearch>
          ) : (
            <p className="text-sm text-muted-foreground">
              No extracted text yet. Wait for processing to finish, or check that the file isn&apos;t blocked. If
              status is complete but text is empty, the document may be unreadable — try re-uploading a clearer
              scan.
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-card">
        <CardHeader>
          <CardTitle>AI analysis</CardTitle>
          <CardDescription>
            Structured finding: Finding / Answer, Evidence Basis, Confidence, Classification (including Correlated),
            Reasoning, Limitations, Next Step. Runs only on extracted text above; supplemental graph data is
            secondary.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AnalyzeButton evidenceId={evidenceId} />
          {!analysis ? (
            <p className="text-sm text-muted-foreground border rounded-md p-4 bg-muted/20">
              No analysis has been run yet. Run AI after extraction completes.
            </p>
          ) : (
            <EvidenceAnalysisSection analysis={analysis} />
          )}
        </CardContent>
      </Card>

      <Card className="border-zinc-800">
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
                <li key={link.id} className="flex flex-wrap items-baseline gap-2 border border-zinc-800 rounded-md px-3 py-2 bg-zinc-950/50">
                  <span className="text-xs text-muted-foreground">{link.link_type}</span>
                  <Link
                    href={`/cases/${caseId}/evidence/${otherId}`}
                    className="text-sky-400 hover:underline"
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

      <Card className="border-zinc-800 bg-zinc-950/40">
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
                  <li key={cl.id} className="rounded-md border border-zinc-800 px-3 py-2 bg-zinc-950/60">
                    <span className="text-foreground font-medium">{cl.title ?? "Cluster"}</span>
                    {cl.rationale ? (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{cl.rationale}</p>
                    ) : null}
                    <Link
                      href={`/cases/${caseId}#evidence-clusters`}
                      className="text-xs text-sky-400 hover:underline mt-1 inline-block"
                    >
                      View on case page
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Separator className="bg-zinc-800" />
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Sticky notes</h3>
            <EvidenceStickyNotesPanel
              caseId={caseId}
              evidenceId={evidenceId}
              currentUserId={user?.id ?? null}
              initial={stickyBundles}
              authorLabel={authorLabel}
            />
          </div>
          <Separator className="bg-zinc-800" />
          <div>
            <h3 className="text-sm font-medium text-foreground mb-2">Threaded comments</h3>
            <CommentThreadView
              caseId={caseId}
              evidenceFileId={evidenceId}
              roots={commentRoots}
              profileName={authorLabel}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
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
                    {authorLabel(n.author_id as string | null)}{" "}
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

function EvidenceAnalysisSection({ analysis }: { analysis: AiAnalysis }) {
  const presentation = resolveAnalysisPresentation(analysis);
  return (
    <div className="space-y-6">
      {presentation.isLegacyShell ? (
        <p className="text-sm text-amber-600 dark:text-amber-400 border border-amber-500/40 rounded-md p-3 bg-amber-500/5">
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
            <p className="text-muted-foreground whitespace-pre-wrap border-t border-zinc-800 pt-2 mt-2">
              Redaction / sensitivity notes (legacy column): {String(analysis.redaction_notes)}
            </p>
          ) : null}
        </TabsContent>
        <TabsContent value="raw" className="mt-3">
          <pre className="text-xs overflow-auto max-h-64 rounded-md border border-zinc-800 p-4 bg-zinc-950 text-foreground">
            {JSON.stringify(analysis.structured ?? {}, null, 2)}
          </pre>
        </TabsContent>
      </Tabs>
    </div>
  );
}
