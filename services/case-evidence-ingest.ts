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
export type IngestResult = { id: string; warning?: string };

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

/**
 * Validate → antivirus scan → storage → register (accepted) → extract text.
 */
export async function ingestUploadedFile(
  supabase: AppSupabaseClient,
  input: {
    caseId: string | null;
    userId: string;
    file: File;
    source?: EvidenceSourcePayload;
    /** Skip duplicate check (user acknowledged). */
    forceDuplicate?: boolean;
  },
): Promise<IngestResult> {
  const { caseId, userId, file, source, forceDuplicate } = input;
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
    });
  } catch (e) {
    await supabase.storage.from(EVIDENCE_BUCKET).remove([path]);
    throw e;
  }

  try {
    await extractTextForEvidence(supabase, evidenceId, mime);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Extraction failed";
    return { id: evidenceId, warning: message };
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
  },
): Promise<IngestResult> {
  const { caseId, userId, url, source, forceDuplicate } = input;
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
    });
  } catch (e) {
    await supabase.storage.from(EVIDENCE_BUCKET).remove([path]);
    throw e;
  }

  try {
    await extractTextForEvidence(supabase, evidenceId, "text/plain");
  } catch (e) {
    const message = e instanceof Error ? e.message : "Extraction failed";
    return { id: evidenceId, warning: [fetchNote, message].filter(Boolean).join(" ") };
  }

  return fetchNote ? { id: evidenceId, warning: fetchNote } : { id: evidenceId };
}
