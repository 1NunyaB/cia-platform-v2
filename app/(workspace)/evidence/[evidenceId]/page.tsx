import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getEvidenceById, listEvidenceVisualTags, getGuestEvidenceById } from "@/services/evidence-service";
import { listCasesForUser } from "@/services/case-service";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";
import { CopyInlineButton } from "@/components/copy-inline-button";
import { AssignEvidenceToCase } from "@/components/assign-evidence-to-case";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { EvidenceFile, EvidenceProcessingStatus } from "@/types";
import { EVIDENCE_SOURCE_TYPE_LABELS, type EvidenceSourceType } from "@/lib/evidence-source";
import { getGuestSessionIdFromCookies } from "@/lib/guest-session";
import { tryCreateServiceClient } from "@/lib/supabase/service";
import type { AppSupabaseClient } from "@/types";
import { EvidenceInlinePreviewCard } from "@/components/evidence-inline-preview-card";
import { EvidenceKindPanel } from "@/components/evidence-kind-panel";
import { RecordEvidenceView } from "@/components/record-evidence-view";
import { EvidenceWorkflowStatusCard } from "@/components/evidence-workflow-status-card";
import { EvidenceDeleteButton } from "@/components/evidence-delete-button";
import { EvidenceLocationGeoPanel } from "@/components/evidence-location-geo-panel";
import { isPlatformDeleteAdmin } from "@/lib/admin-guard";

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

  const [cases, visualTags] = await Promise.all([
    user ? listCasesForUser(supabase, user.id) : Promise.resolve([]),
    listEvidenceVisualTags(dataClient, evidenceId),
  ]);

  const displayTitle = evidencePrimaryLabel({
    display_filename: ev.display_filename ?? null,
    original_filename: ev.original_filename,
  });
  const shortAlias = ev.short_alias?.trim();

  const ps = ev.processing_status as EvidenceProcessingStatus;
  const derivedFromId = (ev as { derived_from_evidence_id?: string | null }).derived_from_evidence_id ?? null;
  let provenanceFromOriginal: { href: string; label: string } | null = null;
  if (derivedFromId) {
    const rootEv = await getEvidenceById(dataClient, derivedFromId);
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
          <Link href="/evidence" className="text-foreground hover:underline">
            ← Evidence Library
          </Link>
          <Link
            href={`/evidence/compare?a=${encodeURIComponent(evidenceId)}`}
            className="text-foreground hover:underline"
          >
            Compare with another file
          </Link>
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">{displayTitle}</h1>
        <p className="mt-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm leading-relaxed text-foreground">
          {user ? (
            <>
              This file is only in your library — not in a case yet. Use <strong className="font-semibold">Add to case</strong>{" "}
              below to unlock case timelines, entities, and shared collaboration on the case evidence page.
            </>
          ) : (
            <>
              This file is in your current guest session.{" "}
              <Link href="/login" className="font-medium text-foreground underline underline-offset-2">
                Sign in
              </Link>{" "}
              to add evidence to a case and keep it in your account.
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

      <EvidenceInlinePreviewCard
        evidenceId={evidenceId}
        showCropToolbar={Boolean(user)}
        mimeType={ev.mime_type as string | null}
      />

      <EvidenceKindPanel
        evidenceId={evidenceId}
        row={ev}
        canEdit={Boolean(user || guestId)}
      />

      {user && (ev as EvidenceFile).image_category === "location" ? (
        <EvidenceLocationGeoPanel
          evidenceId={evidenceId}
          initialLatitude={(ev as EvidenceFile).latitude ?? null}
          initialLongitude={(ev as EvidenceFile).longitude ?? null}
        />
      ) : null}

      <Card className="border-border bg-white shadow-sm">
        <CardHeader className="space-y-0 px-3 py-2 pb-1">
          <CardTitle className="text-sm font-semibold">Evidence status</CardTitle>
          <CardDescription className="text-[11px] leading-snug text-muted-foreground">
            Add to case and quick actions — file preview is above.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 px-3 py-2 pb-3">
          <EvidenceWorkflowStatusCard
            processingStatus={ps}
            evidenceId={evidenceId}
            uploadHref="/evidence/add"
            evidenceDisplayLabel={displayTitle}
            caseIdForWorkspaceAi={null}
            processingErrorMessage={(ev.error_message as string | null | undefined) ?? null}
            assignControl={
              user ? (
                <AssignEvidenceToCase
                  layout="toolbar"
                  evidenceId={evidenceId}
                  cases={cases.map((c) => ({ id: c.id as string, title: (c.title as string) ?? "Untitled" }))}
                />
              ) : undefined
            }
            deleteControl={
              user && isPlatformDeleteAdmin(user) ? (
                <EvidenceDeleteButton evidenceId={evidenceId} redirectTo="/evidence" />
              ) : undefined
            }
          />
          {!user ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href="/login"
                className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
              >
                Sign in
              </Link>
              <Link href="/signup" className="inline-flex h-9 items-center rounded-md border border-input px-4 text-sm">
                Create account
              </Link>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border bg-white shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Details</CardTitle>
          <CardDescription className="text-xs">Source metadata and optional visual tags.</CardDescription>
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
          {showImageEvidenceBlock ? (
            <div className="rounded-md border-2 border-sky-800/50 bg-sky-50 px-2.5 py-2">
              <p className="text-xs font-bold uppercase tracking-wide text-sky-950">Image</p>
              <p className="mt-1 text-[11px] font-medium leading-snug text-sky-950">
                Use <strong className="font-semibold">File view</strong> above to zoom in and crop or save an edited copy
                (new file <span className="font-mono">__0001</span>, <span className="font-mono">__0002</span>, … linked to
                this original).
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
        </CardContent>
      </Card>
    </div>
  );
}
