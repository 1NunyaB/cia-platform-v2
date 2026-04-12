import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEvidenceById, getExtractedText, getAiAnalysis } from "@/services/evidence-service";
import { listCasesForUser } from "@/services/case-service";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";
import { CopyInlineButton } from "@/components/copy-inline-button";
import { AssignEvidenceToCase } from "@/components/assign-evidence-to-case";
import { AnalyzeButton } from "@/components/analyze-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProcessingBadge } from "@/components/processing-badge";
import type { EvidenceProcessingStatus } from "@/types";
import { EVIDENCE_SOURCE_TYPE_LABELS, type EvidenceSourceType } from "@/lib/evidence-source";
import { EvidenceTextSelectionSearch } from "@/components/evidence-text-selection-search";

/**
 * Library evidence not yet tied to a case. Once `case_id` is set, we send users to the case-scoped URL.
 */
export default async function LibraryEvidenceDetailPage({
  params,
}: {
  params: Promise<{ evidenceId: string }>;
}) {
  const { evidenceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const ev = await getEvidenceById(supabase, evidenceId);
  if (!ev) notFound();
  if (ev.uploaded_by !== user.id) notFound();

  if (ev.case_id) {
    redirect(`/cases/${ev.case_id as string}/evidence/${evidenceId}`);
  }

  const [extracted, analysis, cases] = await Promise.all([
    getExtractedText(supabase, evidenceId),
    getAiAnalysis(supabase, evidenceId),
    listCasesForUser(supabase, user.id),
  ]);

  const displayTitle = evidencePrimaryLabel({
    display_filename: ev.display_filename ?? null,
    original_filename: ev.original_filename,
  });
  const shortAlias = ev.short_alias?.trim();

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href="/evidence" className="hover:underline">
            ← Evidence library
          </Link>
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{displayTitle}</h1>
          <ProcessingBadge status={ev.processing_status as EvidenceProcessingStatus} />
        </div>
        <p className="text-xs text-amber-200/80 mt-2 rounded border border-amber-500/20 bg-amber-500/[0.06] px-3 py-2">
          This file is only in your library — not in a case yet. Assign it below to unlock case timelines, entities,
          and shared collaboration on the case evidence page.
        </p>
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
        </div>
      </div>

      <Card className="border-zinc-800 bg-zinc-950/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Assign to a case</CardTitle>
          <CardDescription>
            You keep the same display name, alias, and analysis after assignment — only the case association changes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AssignEvidenceToCase
            evidenceId={evidenceId}
            cases={cases.map((c) => ({ id: c.id as string, title: (c.title as string) ?? "Untitled" }))}
          />
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-zinc-950/70">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Source metadata</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-zinc-200">
          <p>
            <span className="text-muted-foreground">Type: </span>
            {EVIDENCE_SOURCE_TYPE_LABELS[(ev.source_type as EvidenceSourceType) ?? "unknown"] ??
              String(ev.source_type ?? "unknown")}
          </p>
          {ev.source_platform ? (
            <p>
              <span className="text-muted-foreground">Platform: </span>
              {String(ev.source_platform)}
            </p>
          ) : null}
          {ev.source_program ? (
            <p>
              <span className="text-muted-foreground">Program: </span>
              {String(ev.source_program)}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Extracted text</CardTitle>
          <CardDescription>AI analysis uses this text only.</CardDescription>
        </CardHeader>
        <CardContent>
          {extracted?.raw_text ? (
            <EvidenceTextSelectionSearch caseId={null}>
              <pre className="text-xs whitespace-pre-wrap max-h-96 overflow-auto rounded-md border p-4 bg-muted/30 select-text cursor-text">
                {extracted.raw_text as string}
              </pre>
            </EvidenceTextSelectionSearch>
          ) : (
            <p className="text-sm text-muted-foreground">No extracted text yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="border-zinc-800 bg-card">
        <CardHeader>
          <CardTitle>AI analysis</CardTitle>
          <CardDescription>
            Runs on extracted text. Case-scoped entity and cluster graph is applied after you assign this file to a
            case.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <AnalyzeButton evidenceId={evidenceId} />
          {!analysis ? (
            <p className="text-sm text-muted-foreground border rounded-md p-4 bg-muted/20">
              No analysis yet. Run AI after extraction completes.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Analysis on file — open from a case for full panels.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
