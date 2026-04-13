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
  buildStoragePath,
  EVIDENCE_BUCKET,
  findDuplicateEvidence,
  registerEvidenceFile,
} from "@/services/evidence-service";
import { scanEvidenceBuffer } from "@/services/evidence-scan-service";
import { extractTextForEvidence } from "@/services/text-extraction-service";
import { buildImportFilename, fetchTextFromPublicUrl } from "@/services/url-import-service";
import { parsePublicHttpUrl } from "@/lib/url-import-utils";
import { EXTRACTION_SOFT_FAILURE_CLIENT_MESSAGE } from "@/lib/extraction-user-messages";
import { updateEvidenceExtractionFields } from "@/services/evidence-service";

export type IngestResult = { id: string; warning?: string; deferred_extraction?: boolean };

/**
 * Evidence ingestion (Node runtime only via API routes that call this module):
 *
 * 1. **Upload path** (`ingestUploadedFile`): validate policy → AV scan → Storage put →
 *    `registerEvidenceFile` (`evidence_files`, optional `evidence_upload_audit` row) → `extractTextForEvidence`
 *    (download bytes → text layer or OCR → `extracted_texts` by `evidence_file_id`).
 * 2. **URL path** (`ingestEvidenceFromUrl`): fetch text → same policy/scan → Storage as `.txt` →
 *    register → extract (plain text; PDFs from URLs use `extractTextFromBuffer` in fetch only — see
 *    `url-import-service`).
 *
 * Extraction failures set `extraction_status` / `extraction_user_message` (and may keep `processing_status`
 * `accepted` or `complete`) and return `{ warning }` without removing the stored object.
 *
 * `extractTextForEvidence` skips work when `extracted_texts` rows already exist and status is not `error`
 * (unless `{ force: true }` — see `POST /api/evidence/[evidenceId]/extract`).
 */

async function logRejectedUpload(
  supabase: AppSupabaseClient,
  input: { caseId: string | null; userId: string; filename: string; reason: string; kind: "policy" | "scan" },
) {
  try {
    await logActivity(supabase, {
      caseId: input.caseId,
      actorId: input.userId,
      actorLabel: "Analyst",
      action: input.kind === "scan" ? "evidence.upload_blocked" : "evidence.upload_rejected",
      entityType: "evidence_file",
      entityId: null,
      payload: { filename: input.filename, reason: input.reason },
    });
  } catch (e) {
    console.warn("[ingest] activity log failed:", e);
  }
}

/** Validate → antivirus scan → storage → register (accepted) → `extractTextForEvidence`. */
export async function ingestUploadedFile(
  supabase: AppSupabaseClient,
  input: {
    caseId: string | null;
    userId: string;
    file: File;
    source?: EvidenceSourcePayload;
    /** Skip duplicate check (user acknowledged). */
    forceDuplicate?: boolean;
    /** Request-derived audit for `evidence_upload_audit`. */
    audit?: {
      uploaderIp?: string | null;
      userAgent?: string | null;
      uploadMethod: "single_file" | "bulk";
    };
    /** When true, store the file but do not run extraction until the user triggers it on the evidence page. */
    deferExtraction?: boolean;
  },
): Promise<IngestResult> {
  const { caseId, userId, file, source, forceDuplicate, audit, deferExtraction } = input;
  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || null;
  const contentSha256 = sha256Hex(buffer);

  if (!forceDuplicate) {
    const dup = await findDuplicateEvidence(supabase, {
      contentSha256,
      originalFilename: file.name,
      fileSize: file.size,
      uploadedByUserId: userId,
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
      await logRejectedUpload(supabase, {
        caseId,
        userId,
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
    await logRejectedUpload(supabase, {
      caseId,
      userId,
      filename: file.name,
      reason: scan.detail,
      kind: "scan",
    });
    throw new EvidenceScanBlockedError(
      scan.detail || "This file failed the security scan and was not stored.",
    );
  }

  const evidenceId = crypto.randomUUID();
  const path = buildStoragePath(caseId, userId, evidenceId, file.name);

  const { error: upErr } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(path, buffer, { contentType: mime || "application/octet-stream" });

  if (upErr) {
    throw new Error(upErr.message);
  }

  try {
    await registerEvidenceFile(supabase, {
      id: evidenceId,
      caseId,
      userId,
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
    console.error("[ingest] extractTextForEvidence threw:", e);
    try {
      await updateEvidenceExtractionFields(supabase, evidenceId, {
        extractionStatus: "retry_needed",
        extractionUserMessage: msg,
      });
    } catch (patchErr) {
      console.warn("[ingest] could not persist extraction error:", patchErr);
    }
    return { id: evidenceId, warning: EXTRACTION_SOFT_FAILURE_CLIENT_MESSAGE };
  }

  return { id: evidenceId };
}

/**
 * URL import: fetch → policy + scan on buffer → store as .txt → accepted → extract.
 */
export async function ingestEvidenceFromUrl(
  supabase: AppSupabaseClient,
  input: {
    caseId: string | null;
    userId: string;
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
  const { caseId, userId, url, source, forceDuplicate, audit, deferExtraction } = input;
  const parsed = parsePublicHttpUrl(url);
  const fetched = await fetchTextFromPublicUrl(url);
  const { text, extractionNote: fetchNote } = fetched;

  const filename = buildImportFilename(parsed);
  const buffer = Buffer.from(text, "utf8");
  const contentSha256 = sha256Hex(buffer);

  if (!forceDuplicate) {
    const dup = await findDuplicateEvidence(supabase, {
      contentSha256,
      originalFilename: filename,
      fileSize: buffer.length,
      uploadedByUserId: userId,
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
      await logRejectedUpload(supabase, {
        caseId,
        userId,
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
    await logRejectedUpload(supabase, {
      caseId,
      userId,
      filename,
      reason: scan.detail,
      kind: "scan",
    });
    throw new EvidenceScanBlockedError(
      scan.detail || "Imported content failed the security scan and was not stored.",
    );
  }

  const evidenceId = crypto.randomUUID();
  const path = buildStoragePath(caseId, userId, evidenceId, filename);

  const { error: upErr } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(path, buffer, { contentType: "text/plain; charset=utf-8" });

  if (upErr) {
    throw new Error(upErr.message);
  }

  try {
    await registerEvidenceFile(supabase, {
      id: evidenceId,
      caseId,
      userId,
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
    console.error("[ingest] URL import extract threw:", e);
    try {
      await updateEvidenceExtractionFields(supabase, evidenceId, {
        extractionStatus: "retry_needed",
        extractionUserMessage: msg,
      });
    } catch (patchErr) {
      console.warn("[ingest] could not persist extraction error:", patchErr);
    }
    return { id: evidenceId, warning: [fetchNote, EXTRACTION_SOFT_FAILURE_CLIENT_MESSAGE].filter(Boolean).join(" ") };
  }

  return fetchNote ? { id: evidenceId, warning: fetchNote } : { id: evidenceId };
}
