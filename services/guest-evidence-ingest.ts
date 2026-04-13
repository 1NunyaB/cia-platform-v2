import type { AppSupabaseClient } from "@/types";
import type { EvidenceSourcePayload } from "@/lib/evidence-source";
import {
  EvidenceScanBlockedError,
  UploadPolicyError,
} from "@/lib/evidence-upload-errors";
import { assertEvidenceUploadAllowed } from "@/lib/evidence-upload-policy";
import { logActivity } from "@/services/activity-service";
import { EvidenceDuplicateError } from "@/lib/evidence-upload-errors";
import { sha256Hex } from "@/lib/file-fingerprint";
import {
  buildGuestLibraryStoragePath,
  EVIDENCE_BUCKET,
  findDuplicateGuestEvidence,
  registerGuestEvidenceFile,
} from "@/services/evidence-service";
import { scanEvidenceBuffer } from "@/services/evidence-scan-service";
import { extractTextForEvidence } from "@/services/text-extraction-service";
import { buildImportFilename, fetchTextFromPublicUrl } from "@/services/url-import-service";
import { parsePublicHttpUrl } from "@/lib/url-import-utils";
import { EXTRACTION_SOFT_FAILURE_CLIENT_MESSAGE } from "@/lib/extraction-user-messages";
import { updateEvidenceExtractionFields } from "@/services/evidence-service";

import type { IngestResult } from "@/services/case-evidence-ingest";

async function logRejectedGuestUpload(
  supabase: AppSupabaseClient,
  input: { guestSessionId: string; filename: string; reason: string; kind: "policy" | "scan" },
) {
  try {
    await logActivity(supabase, {
      caseId: null,
      actorId: null,
      actorLabel: "Guest",
      action: input.kind === "scan" ? "evidence.upload_blocked" : "evidence.upload_rejected",
      entityType: "evidence_file",
      entityId: null,
      payload: {
        filename: input.filename,
        reason: input.reason,
        guest_session_id: input.guestSessionId,
      },
    });
  } catch (e) {
    console.warn("[guest ingest] activity log failed:", e);
  }
}

/** Library upload for anonymous guest sessions (service-role Supabase client). */
export async function ingestGuestUploadedFile(
  supabase: AppSupabaseClient,
  input: {
    guestSessionId: string;
    file: File;
    source?: EvidenceSourcePayload;
    forceDuplicate?: boolean;
    audit?: {
      uploaderIp?: string | null;
      userAgent?: string | null;
      uploadMethod: "single_file" | "bulk";
    };
    deferExtraction?: boolean;
  },
): Promise<IngestResult> {
  const { guestSessionId, file, source, forceDuplicate, audit, deferExtraction } = input;
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || null;
  const contentSha256 = sha256Hex(buffer);

  if (!forceDuplicate) {
    const dup = await findDuplicateGuestEvidence(supabase, {
      guestSessionId,
      contentSha256,
      originalFilename: file.name,
      fileSize: file.size,
    });
    if (dup) {
      throw new EvidenceDuplicateError(
        "This evidence appears to already exist in the database.",
        dup,
      );
    }
  }

  try {
    assertEvidenceUploadAllowed({
      buffer,
      originalFilename: file.name,
      mimeType: mime,
      declaredSize: file.size,
    });
  } catch (e) {
    if (e instanceof UploadPolicyError) {
      await logRejectedGuestUpload(supabase, {
        guestSessionId,
        filename: file.name,
        reason: e.message,
        kind: "policy",
      });
    }
    throw e;
  }

  const scan = await scanEvidenceBuffer({
    buffer,
    filename: file.name,
    mimeType: mime,
  });

  if (!scan.clean) {
    await logRejectedGuestUpload(supabase, {
      guestSessionId,
      filename: file.name,
      reason: scan.detail,
      kind: "scan",
    });
    throw new EvidenceScanBlockedError(
      scan.detail || "This file failed the security scan and was not stored.",
    );
  }

  const evidenceId = crypto.randomUUID();
  const path = buildGuestLibraryStoragePath(guestSessionId, evidenceId, file.name);

  const { error: upErr } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(path, buffer, { contentType: mime || "application/octet-stream" });

  if (upErr) {
    throw new Error(upErr.message);
  }

  try {
    await registerGuestEvidenceFile(supabase, {
      id: evidenceId,
      guestSessionId,
      storagePath: path,
      originalFilename: file.name,
      mimeType: mime,
      fileSize: file.size,
      contentSha256,
      processingStatus: "accepted",
      ...(source ? { source } : {}),
      ...(audit
        ? {
            audit: {
              uploaderIp: audit.uploaderIp,
              userAgent: audit.userAgent,
              uploadMethod: audit.uploadMethod,
            },
          }
        : {}),
    });
  } catch (e) {
    await supabase.storage.from(EVIDENCE_BUCKET).remove([path]);
    throw e;
  }

  if (deferExtraction) {
    await updateEvidenceExtractionFields(supabase, evidenceId, {
      extractionStatus: "pending",
      extractionUserMessage:
        "Extraction was skipped at upload. Open this evidence file and run extraction when you are ready.",
    });
    return { id: evidenceId, deferred_extraction: true };
  }

  try {
    const extracted = await extractTextForEvidence(supabase, evidenceId, mime);
    if (!extracted.ok) {
      return { id: evidenceId, warning: EXTRACTION_SOFT_FAILURE_CLIENT_MESSAGE };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Extraction failed unexpectedly";
    console.error("[guest ingest] extractTextForEvidence threw:", e);
    try {
      await updateEvidenceExtractionFields(supabase, evidenceId, {
        extractionStatus: "retry_needed",
        extractionUserMessage: msg,
      });
    } catch (patchErr) {
      console.warn("[guest ingest] could not persist extraction error:", patchErr);
    }
    return { id: evidenceId, warning: EXTRACTION_SOFT_FAILURE_CLIENT_MESSAGE };
  }

  return { id: evidenceId };
}

export async function ingestGuestEvidenceFromUrl(
  supabase: AppSupabaseClient,
  input: {
    guestSessionId: string;
    url: string;
    source?: EvidenceSourcePayload;
    forceDuplicate?: boolean;
    audit?: {
      uploaderIp?: string | null;
      userAgent?: string | null;
      uploadMethod?: "url_import";
    };
    deferExtraction?: boolean;
  },
): Promise<IngestResult> {
  const { guestSessionId, url, source, forceDuplicate, audit, deferExtraction } = input;
  const parsed = parsePublicHttpUrl(url);
  const fetched = await fetchTextFromPublicUrl(url);
  const { text, extractionNote: fetchNote } = fetched;

  const filename = buildImportFilename(parsed);
  const buffer = Buffer.from(text, "utf8");
  const contentSha256 = sha256Hex(buffer);

  if (!forceDuplicate) {
    const dup = await findDuplicateGuestEvidence(supabase, {
      guestSessionId,
      contentSha256,
      originalFilename: filename,
      fileSize: buffer.length,
    });
    if (dup) {
      throw new EvidenceDuplicateError(
        "This evidence appears to already exist in the database.",
        dup,
      );
    }
  }

  try {
    assertEvidenceUploadAllowed({
      buffer,
      originalFilename: filename,
      mimeType: "text/plain",
      declaredSize: buffer.length,
    });
  } catch (e) {
    if (e instanceof UploadPolicyError) {
      await logRejectedGuestUpload(supabase, {
        guestSessionId,
        filename,
        reason: e.message,
        kind: "policy",
      });
    }
    throw e;
  }

  const scan = await scanEvidenceBuffer({
    buffer,
    filename,
    mimeType: "text/plain",
  });

  if (!scan.clean) {
    await logRejectedGuestUpload(supabase, {
      guestSessionId,
      filename,
      reason: scan.detail,
      kind: "scan",
    });
    throw new EvidenceScanBlockedError(
      scan.detail || "Imported content failed the security scan and was not stored.",
    );
  }

  const evidenceId = crypto.randomUUID();
  const path = buildGuestLibraryStoragePath(guestSessionId, evidenceId, filename);

  const { error: upErr } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(path, buffer, { contentType: "text/plain; charset=utf-8" });

  if (upErr) {
    throw new Error(upErr.message);
  }

  try {
    await registerGuestEvidenceFile(supabase, {
      id: evidenceId,
      guestSessionId,
      storagePath: path,
      originalFilename: filename,
      mimeType: "text/plain",
      fileSize: buffer.length,
      contentSha256,
      processingStatus: "accepted",
      ...(source ? { source } : {}),
      ...(audit
        ? {
            audit: {
              uploaderIp: audit.uploaderIp,
              userAgent: audit.userAgent,
              uploadMethod: audit.uploadMethod ?? "url_import",
            },
          }
        : {}),
    });
  } catch (e) {
    await supabase.storage.from(EVIDENCE_BUCKET).remove([path]);
    throw e;
  }

  if (deferExtraction) {
    await updateEvidenceExtractionFields(supabase, evidenceId, {
      extractionStatus: "pending",
      extractionUserMessage:
        "Extraction was skipped at import. Open this evidence file and run extraction when you are ready.",
    });
    return { id: evidenceId, deferred_extraction: true };
  }

  try {
    const extracted = await extractTextForEvidence(supabase, evidenceId, "text/plain");
    if (!extracted.ok) {
      const w = [fetchNote, EXTRACTION_SOFT_FAILURE_CLIENT_MESSAGE].filter(Boolean).join(" ");
      return { id: evidenceId, warning: w };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Extraction failed unexpectedly";
    console.error("[guest ingest] URL extract threw:", e);
    try {
      await updateEvidenceExtractionFields(supabase, evidenceId, {
        extractionStatus: "retry_needed",
        extractionUserMessage: msg,
      });
    } catch (patchErr) {
      console.warn("[guest ingest] could not persist extraction error:", patchErr);
    }
    return { id: evidenceId, warning: [fetchNote, EXTRACTION_SOFT_FAILURE_CLIENT_MESSAGE].filter(Boolean).join(" ") };
  }

  return fetchNote ? { id: evidenceId, warning: fetchNote } : { id: evidenceId };
}
