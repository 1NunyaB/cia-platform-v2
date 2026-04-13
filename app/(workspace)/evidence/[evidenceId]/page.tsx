import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getEvidenceById,
  getExtractedText,
  getAiAnalysis,
  getEvidenceNeedsExtraction,
  listEvidenceVisualTags,
  getGuestEvidenceById,
} from "@/services/evidence-service";
import { listCasesForUser } from "@/services/case-service";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";
import { CopyInlineButton } from "@/components/copy-inline-button";
import { AssignEvidenceToCase } from "@/components/assign-evidence-to-case";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProcessingBadge } from "@/components/processing-badge";
import type { EvidenceProcessingStatus } from "@/types";
import { EVIDENCE_SOURCE_TYPE_LABELS, type EvidenceSourceType } from "@/lib/evidence-source";
import { EvidenceTextSelectionSearch } from "@/components/evidence-text-selection-search";
import { getGuestSessionIdFromCookies } from "@/lib/guest-session";
import { tryCreateServiceClient } from "@/lib/supabase/service";
import type { AppSupabaseClient } from "@/types";
import { isExtractionPlaceholderText } from "@/lib/extraction-messages";
import { EvidenceFilePreview } from "@/components/evidence-file-preview";
import { EvidenceProcessingCallout } from "@/components/evidence-processing-callout";
import { RecordEvidenceView } from "@/components/record-evidence-view";
import { EvidenceWorkflowStatusCard } from "@/components/evidence-workflow-status-card";

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
  const guestId = await getGuestSessionIdFromCookies();

  if (!user && !guestId) {
    return null;
  }

  let ev: NonNullable<Awaited<ReturnType<typeof getEvidenceById>>>;
  let dataClient: AppSupabaseClient;

  if (user) {
    const row = await getEvidenceById(supabase, evidenceId);
    if (!row) notFound();
    if ((row.uploaded_by as string | null) !== user.id) notFound();
    ev = row;
    dataClient = supabase;
  } else {
    const service = tryCreateServiceClient();
    if (!service) {
      return (
        <p className="text-sm text-muted-foreground">
          Configure <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> for guest evidence access.
        </p>
      );
    }
    const row = await getGuestEvidenceById(service, evidenceId, guestId!);
    if (!row) notFound();
    ev = row;
    dataClient = service;
  }

  if (ev.case_id) {
    redirect(`/cases/${ev.case_id as string}/evidence/${evidenceId}`);
  }

  const [extracted, analysis, cases, needsManualExtraction, visualTags] = await Promise.all([
    getExtractedText(dataClient, evidenceId),
    getAiAnalysis(dataClient, evidenceId),
    user ? listCasesForUser(supabase, user.id) : Promise.resolve([]),
    getEvidenceNeedsExtraction(dataClient, evidenceId),
    listEvidenceVisualTags(dataClient, evidenceId),
  ]);

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
          <Link href="/evidence" className="text-foreground hover:underline">
            ← Evidence library
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
        <p className="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm leading-relaxed text-foreground">
          {user ? (
            <>
              This file is only in your library — not in a case yet. Assign it below to unlock case timelines,
              entities, and shared collaboration on the case evidence page.
            </>
          ) : (
            <>
              This file is in your current guest session.{" "}
              <Link href="/login" className="font-medium text-foreground underline underline-offset-2">
                Sign in
              </Link>{" "}
              to assign evidence to a case and keep it in your account.
            </>
          )}
        </p>
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
        <Card className="border-border bg-white shadow-sm">
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
      ) : (
        <Card className="border-border bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cases</CardTitle>
            <CardDescription>
              Create an account or sign in to attach this file to an investigation and collaborate with your team.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Sign in
            </Link>
            <Link href="/signup" className="inline-flex h-9 items-center rounded-md border border-input px-4 text-sm">
              Create account
            </Link>
          </CardContent>
        </Card>
      )}

      <Card className="border-border bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Source metadata</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2 text-foreground">
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

      <Card className="border-border bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Image evidence and visual tags</CardTitle>
          <CardDescription>
            Photo-first images may have limited OCR. Visual object/feature tags are stored separately for search.
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

      <Card className="border-border bg-white shadow-sm">
        <CardHeader>
          <CardTitle>Extracted text</CardTitle>
          <CardDescription>
            AI analysis uses this text only. Status should progress Accepted → Extracting → Complete unless an error is
            recorded.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {hasDisplayableText ? (
            <EvidenceTextSelectionSearch caseId={null}>
              <pre className="text-xs whitespace-pre-wrap max-h-96 overflow-auto rounded-md border border-document-border bg-document p-4 text-foreground select-text cursor-text">
                {rawExtracted}
              </pre>
            </EvidenceTextSelectionSearch>
          ) : rawExtracted.length > 0 ? (
            <>
              {extractionStatus === "limited" || extractionStatus === "low_confidence" ? (
                <p className="text-sm text-foreground rounded-md border border-sky-300 bg-sky-50 px-3 py-2">
                  This appears to be primarily image/photo evidence. OCR found only limited text, so visual review (zoom,
                  scene/object inspection) is likely more useful than document-style extraction.
                </p>
              ) : (
                <p className="text-sm text-foreground rounded-md border border-sky-300 bg-sky-50 px-3 py-2">
                  Stored content is only a system placeholder (no readable text was extracted). Run extraction again after
                  fixing the file, or open the{" "}
                  <Link href="/evidence" className="font-medium text-blue-900 underline">
                    upload
                  </Link>{" "}
                  flow to replace it.
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
            Runs on extracted text. Case-scoped entity and cluster graph is applied after you assign this file to a
            case.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!analysis ? (
            <p className="text-sm text-foreground border border-border rounded-md p-4 bg-panel">
              No analysis yet. Use <strong className="font-semibold">Run AI analysis</strong> in Evidence processing
              after extraction completes.
            </p>
          ) : (
            <p className="text-sm text-foreground">Analysis on file — open from a case for full panels.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
