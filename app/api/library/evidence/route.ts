import { ingestUploadedFile } from "@/services/case-evidence-ingest";
import { ingestGuestUploadedFile } from "@/services/guest-evidence-ingest";
import { buildDuplicateEvidenceResponse } from "@/services/duplicate-evidence-response";
import { EvidenceDuplicateError, isClientSafeUploadError } from "@/lib/evidence-upload-errors";
import { parseEvidenceSourceFromFormData } from "@/lib/evidence-source";
import { deferExtractionFromFormData } from "@/lib/evidence-defer-extraction";
import { isPlatformDeleteAdmin } from "@/lib/admin-guard";
import { requestClientIp, requestUserAgent } from "@/lib/request-audit";
import { resolveRequestActor } from "@/lib/resolve-request-actor";
import { logUsageEvent } from "@/services/usage-log-service";
import { touchGuestSession } from "@/services/guest-session-service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export type BulkLibraryEvidenceItemResult = {
  filename: string;
  id?: string;
  warning?: string;
  error?: string;
  duplicate?: boolean;
  no_new_record?: boolean;
  message?: string;
  needs_extraction?: boolean;
  deferred_extraction?: boolean;
  existing?: import("@/lib/evidence-upload-errors").DuplicateEvidenceMatch;
};

/** Upload evidence to the database without attaching a case (personal library). Authenticated or guest. */
export async function POST(request: Request) {
  const actor = await resolveRequestActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const source = parseEvidenceSourceFromFormData(formData);
  const requestedForceDuplicate =
    formData.get("force_duplicate") === "true" || formData.get("force_duplicate") === "1";
  const forceDuplicate =
    actor.mode === "user"
      ? requestedForceDuplicate &&
        isPlatformDeleteAdmin((await actor.supabase.auth.getUser()).data.user ?? null)
      : false;
  const multi = formData.getAll("files").filter((x): x is File => x instanceof File);
  const single = formData.get("file");
  const uploaderIp = requestClientIp(request);
  const userAgent = requestUserAgent(request);
  const deferExtraction = deferExtractionFromFormData(formData);

  if (multi.length > 0) {
    const results: BulkLibraryEvidenceItemResult[] = [];
    for (const file of multi) {
      try {
        if (actor.mode === "user") {
          const r = await ingestUploadedFile(actor.supabase, {
            caseId: null,
            userId: actor.userId,
            file,
            source,
            forceDuplicate,
            deferExtraction,
            audit: { uploaderIp, userAgent, uploadMethod: "bulk" },
          });
          await logUsageEvent({
            userId: actor.userId,
            action: "evidence.upload",
            meta: { scope: "library", method: "bulk" },
          });
          results.push({
            filename: file.name,
            id: r.id,
            ...(r.warning ? { warning: r.warning } : {}),
            ...(r.deferred_extraction ? { deferred_extraction: true } : {}),
          });
        } else {
          const r = await ingestGuestUploadedFile(actor.service, {
            guestSessionId: actor.guestSessionId,
            file,
            source,
            forceDuplicate,
            deferExtraction,
            audit: { uploaderIp, userAgent, uploadMethod: "bulk" },
          });
          await touchGuestSession(actor.service, actor.guestSessionId);
          await logUsageEvent({
            guestSessionId: actor.guestSessionId,
            action: "evidence.upload",
            meta: { scope: "library", method: "bulk" },
          });
          results.push({
            filename: file.name,
            id: r.id,
            ...(r.warning ? { warning: r.warning } : {}),
            ...(r.deferred_extraction ? { deferred_extraction: true } : {}),
          });
        }
      } catch (e) {
        if (e instanceof EvidenceDuplicateError) {
          const dupClient = actor.mode === "user" ? actor.supabase : actor.service;
          const body = await buildDuplicateEvidenceResponse(dupClient, e);
          results.push({
            filename: file.name,
            duplicate: body.duplicate,
            no_new_record: body.no_new_record,
            message: body.message,
            needs_extraction: body.needs_extraction,
            existing: body.existing,
          });
        } else {
          const message = e instanceof Error ? e.message : "Upload failed";
          results.push({ filename: file.name, error: message });
        }
      }
    }
    return NextResponse.json({ results }, { status: 201 });
  }

  if (single instanceof File) {
    try {
      if (actor.mode === "user") {
        const r = await ingestUploadedFile(actor.supabase, {
          caseId: null,
          userId: actor.userId,
          file: single,
          source,
          forceDuplicate,
          deferExtraction,
          audit: { uploaderIp, userAgent, uploadMethod: "single_file" },
        });
        await logUsageEvent({
          userId: actor.userId,
          action: "evidence.upload",
          meta: { scope: "library", method: "single_file" },
        });
        if (r.warning) {
          return NextResponse.json(
            { id: r.id, warning: r.warning, ...(r.deferred_extraction ? { deferred_extraction: true } : {}) },
            { status: 201 },
          );
        }
        if (r.deferred_extraction) {
          return NextResponse.json({ id: r.id, deferred_extraction: true }, { status: 201 });
        }
        return NextResponse.json({ id: r.id }, { status: 201 });
      }

      const r = await ingestGuestUploadedFile(actor.service, {
        guestSessionId: actor.guestSessionId,
        file: single,
        source,
        forceDuplicate,
        deferExtraction,
        audit: { uploaderIp, userAgent, uploadMethod: "single_file" },
      });
      await touchGuestSession(actor.service, actor.guestSessionId);
      await logUsageEvent({
        guestSessionId: actor.guestSessionId,
        action: "evidence.upload",
        meta: { scope: "library", method: "single_file" },
      });
      if (r.warning) {
        return NextResponse.json(
          { id: r.id, warning: r.warning, ...(r.deferred_extraction ? { deferred_extraction: true } : {}) },
          { status: 201 },
        );
      }
      if (r.deferred_extraction) {
        return NextResponse.json({ id: r.id, deferred_extraction: true }, { status: 201 });
      }
      return NextResponse.json({ id: r.id }, { status: 201 });
    } catch (e) {
      if (e instanceof EvidenceDuplicateError) {
        const dupClient = actor.mode === "user" ? actor.supabase : actor.service;
        const body = await buildDuplicateEvidenceResponse(dupClient, e);
        return NextResponse.json(body, { status: 200 });
      }
      const message = e instanceof Error ? e.message : "Upload failed";
      const status = isClientSafeUploadError(e) ? 400 : 500;
      return NextResponse.json({ error: message }, { status });
    }
  }

  return NextResponse.json({ error: "Missing file or files" }, { status: 400 });
}
