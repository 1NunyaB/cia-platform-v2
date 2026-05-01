import { ingestUploadedFile } from "@/services/case-evidence-ingest";
import { buildDuplicateEvidenceResponse } from "@/services/duplicate-evidence-response";
import { EvidenceDuplicateError, isClientSafeUploadError } from "@/lib/evidence-upload-errors";
import { parseImageCategoryFromForm } from "@/lib/image-categories";
import { parseEvidenceSourceFromFormData } from "@/lib/evidence-source";
import { isPlatformDeleteAdmin } from "@/lib/admin-guard";
import { requestClientIp, requestUserAgent } from "@/lib/request-audit";
import { resolveRequestActor } from "@/lib/resolve-request-actor";
import { logUsageEvent } from "@/services/usage-log-service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export type BulkEvidenceItemResult = {
  filename: string;
  id?: string;
  warning?: string;
  error?: string;
  duplicate?: boolean;
  no_new_record?: boolean;
  message?: string;
  needs_extraction?: boolean;
  existing?: import("@/lib/evidence-upload-errors").DuplicateEvidenceMatch;
};

function classifyUploadFailureMessage(err: unknown): { status: number; message: string } {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const msg = raw.toLowerCase();
  if (
    msg.includes("forbidden") ||
    msg.includes("can_write_case") ||
    msg.includes("row-level security policy") ||
    msg.includes("permission denied")
  ) {
    if (msg.includes("storage") || msg.includes("object")) {
      return { status: 403, message: "Not allowed to upload this file to storage for this case." };
    }
    if (msg.includes("evidence_files") || msg.includes("next_evidence_file_sequence")) {
      return { status: 403, message: "Not allowed to attach evidence to this case." };
    }
    return { status: 403, message: "Not allowed to attach evidence to this case." };
  }
  return { status: 500, message: raw || "Upload failed" };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await params;
  const actor = await resolveRequestActor();
  if (!actor || actor.mode !== "user") {
    return NextResponse.json({ error: "Sign in to add evidence to a case." }, { status: 401 });
  }
  const supabase = actor.supabase;
  const user = { id: actor.userId };

  const formData = await request.formData();
  let imageCategory: string | null = null;
  try {
    imageCategory = parseImageCategoryFromForm(formData);
  } catch {
    return NextResponse.json({ error: "Invalid image_category" }, { status: 400 });
  }
  const source = parseEvidenceSourceFromFormData(formData);
  const incidentEntryIdRaw = formData.get("incident_entry_id");
  const incidentEntryId =
    typeof incidentEntryIdRaw === "string" && incidentEntryIdRaw.trim() ? incidentEntryIdRaw.trim() : null;
  const requestedForceDuplicate =
    formData.get("force_duplicate") === "true" || formData.get("force_duplicate") === "1";
  const forceDuplicate =
    requestedForceDuplicate &&
    isPlatformDeleteAdmin((await supabase.auth.getUser()).data.user ?? null);
  const multi = formData.getAll("files").filter((x): x is File => x instanceof File);
  const single = formData.get("file");
  const uploaderIp = requestClientIp(request);
  const userAgent = requestUserAgent(request);
  if (multi.length > 0) {
    const results: BulkEvidenceItemResult[] = [];
    for (const file of multi) {
      try {
        const r = await ingestUploadedFile(supabase, {
          caseId,
          incidentEntryId,
          userId: user.id,
          file,
          source,
          forceDuplicate,
          imageCategory,
          audit: { uploaderIp, userAgent, uploadMethod: "bulk" },
        });
        await logUsageEvent({
          userId: user.id,
          action: "evidence.upload",
          meta: { scope: "case", caseId, method: "bulk" },
        });
        results.push({
          filename: file.name,
          id: r.id,
          ...(r.warning ? { warning: r.warning } : {}),
        });
      } catch (e) {
        if (e instanceof EvidenceDuplicateError) {
          const body = await buildDuplicateEvidenceResponse(supabase, e);
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
      const r = await ingestUploadedFile(supabase, {
        caseId,
        incidentEntryId,
        userId: user.id,
        file: single,
        source,
        forceDuplicate,
        imageCategory,
        audit: { uploaderIp, userAgent, uploadMethod: "single_file" },
      });
      await logUsageEvent({
        userId: user.id,
        action: "evidence.upload",
        meta: { scope: "case", caseId, method: "single_file" },
      });
      if (r.warning) {
        return NextResponse.json({ id: r.id, warning: r.warning }, { status: 201 });
      }
      return NextResponse.json({ id: r.id }, { status: 201 });
    } catch (e) {
      if (e instanceof EvidenceDuplicateError) {
        const body = await buildDuplicateEvidenceResponse(supabase, e);
        return NextResponse.json(body, { status: 200 });
      }
      if (isClientSafeUploadError(e)) {
        const message = e instanceof Error ? e.message : "Upload failed";
        return NextResponse.json({ error: message }, { status: 400 });
      }
      const classified = classifyUploadFailureMessage(e);
      return NextResponse.json({ error: classified.message }, { status: classified.status });
    }
  }

  return NextResponse.json({ error: "Missing file or files" }, { status: 400 });
}
