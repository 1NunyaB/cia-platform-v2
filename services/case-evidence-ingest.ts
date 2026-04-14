import type { AppSupabaseClient } from "@/types";
import type { EvidenceSourcePayload, EvidenceSourceType } from "@/lib/evidence-source";
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
  isEvidenceCaseMembershipTableError,
  registerEvidenceFile,
  updateEvidenceStatus,
} from "@/services/evidence-service";
import { buildDerivativeOriginalFilename, buildPdfPageOriginalFilename } from "@/lib/evidence-derivative-naming";
import { PDFDocument } from "pdf-lib";
import { scanEvidenceBuffer } from "@/services/evidence-scan-service";
import { buildImportFilename, fetchTextFromPublicUrl } from "@/services/url-import-service";
import { parsePublicHttpUrl } from "@/lib/url-import-utils";

export type IngestResult = { id: string; warning?: string };

/**
 * Evidence ingestion: validate policy → AV scan → Storage → `registerEvidenceFile` → mark **complete** (ready to view).
 * Text for AI analysis is built on demand when the user runs analysis (see analyze API), not as a separate upload step.
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

/** Validate → antivirus scan → storage → register → complete (viewable). */
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
  },
): Promise<IngestResult> {
  const { caseId, userId, file, source, forceDuplicate, audit } = input;
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

  await updateEvidenceStatus(supabase, evidenceId, "complete");
  return { id: evidenceId };
}

/**
 * URL import: fetch → policy + scan on buffer → store as .txt → register → complete.
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
  },
): Promise<IngestResult> {
  const { caseId, userId, url, source, forceDuplicate, audit } = input;
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

  await updateEvidenceStatus(supabase, evidenceId, "complete");
  return fetchNote ? { id: evidenceId, warning: fetchNote } : { id: evidenceId };
}

async function getNextDerivativeIndex(supabase: AppSupabaseClient, rootId: string): Promise<number> {
  const { data, error } = await supabase
    .from("evidence_files")
    .select("derivative_index")
    .eq("derived_from_evidence_id", rootId)
    .not("derivative_index", "is", null)
    .order("derivative_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  const n = data?.derivative_index != null ? Number(data.derivative_index) : 0;
  return n + 1;
}

async function copyCaseMembershipsForDerivative(
  supabase: AppSupabaseClient,
  sourceEvidenceId: string,
  newEvidenceId: string,
) {
  const { data, error } = await supabase
    .from("evidence_case_memberships")
    .select("case_id")
    .eq("evidence_file_id", sourceEvidenceId);
  if (error) {
    if (isEvidenceCaseMembershipTableError(error)) return;
    throw new Error(error.message);
  }
  for (const row of data ?? []) {
    const cid = row.case_id as string;
    const { error: insErr } = await supabase.from("evidence_case_memberships").insert({
      evidence_file_id: newEvidenceId,
      case_id: cid,
    });
    if (insErr && !isEvidenceCaseMembershipTableError(insErr)) {
      console.warn("[ingest derivative] membership copy:", insErr.message);
    }
  }
}

/**
 * Saves a user crop/edit as a new evidence row + storage object. Original file is never modified.
 * Filename uses root original name + `__0001` style suffix; provenance via `derived_from_evidence_id` → root.
 */
export async function ingestDerivativeUploadedFile(
  supabase: AppSupabaseClient,
  input: {
    sourceEvidenceId: string;
    userId: string;
    file: File;
    audit?: { uploaderIp?: string | null; userAgent?: string | null };
  },
): Promise<IngestResult> {
  const { sourceEvidenceId, userId, file, audit } = input;

  const { data: src, error: srcErr } = await supabase
    .from("evidence_files")
    .select(
      "id, case_id, derived_from_evidence_id, original_filename, mime_type, source_type, source_platform, source_program, source_url",
    )
    .eq("id", sourceEvidenceId)
    .maybeSingle();
  if (srcErr || !src) throw new Error("Source evidence not found");

  const rootId = (src.derived_from_evidence_id as string | null) ?? (src.id as string);
  const { data: root, error: rootErr } = await supabase
    .from("evidence_files")
    .select("id, original_filename, source_type, source_platform, source_program, source_url")
    .eq("id", rootId)
    .maybeSingle();
  if (rootErr || !root) throw new Error("Root evidence not found");

  const nextIdx = await getNextDerivativeIndex(supabase, rootId);
  const originalFilename = buildDerivativeOriginalFilename(
    root.original_filename as string,
    nextIdx,
    file.name,
  );

  const buffer = Buffer.from(await file.arrayBuffer());
  const mime = file.type || null;
  const contentSha256 = sha256Hex(buffer);

  if (!input.file.size) {
    throw new Error("Empty file.");
  }

  const dup = await findDuplicateEvidence(supabase, {
    contentSha256,
    originalFilename,
    fileSize: file.size,
    uploadedByUserId: userId,
  });
  if (dup) {
    throw new EvidenceDuplicateError("This file matches existing evidence (same content hash).", dup);
  }

  try {
    assertEvidenceUploadAllowed({
      buffer,
      originalFilename,
      mimeType: mime,
      declaredSize: file.size,
    });
  } catch (e) {
    if (e instanceof UploadPolicyError) {
      await logRejectedUpload(supabase, {
        caseId: (src.case_id as string | null) ?? null,
        userId,
        filename: originalFilename,
        reason: e.message,
        kind: "policy",
      });
    }
    throw e;
  }

  const scan = await scanEvidenceBuffer({
    buffer,
    filename: originalFilename,
    mimeType: mime,
  });

  if (!scan.clean) {
    await logRejectedUpload(supabase, {
      caseId: (src.case_id as string | null) ?? null,
      userId,
      filename: originalFilename,
      reason: scan.detail,
      kind: "scan",
    });
    throw new EvidenceScanBlockedError(
      scan.detail || "This file failed the security scan and was not stored.",
    );
  }

  const evidenceId = crypto.randomUUID();
  const caseId = (src.case_id as string | null) ?? null;
  const path = buildStoragePath(caseId, userId, evidenceId, originalFilename);

  const { error: upErr } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(path, buffer, { contentType: mime || "application/octet-stream" });

  if (upErr) {
    throw new Error(upErr.message);
  }

  const sourcePayload: EvidenceSourcePayload | undefined =
    root.source_type != null
      ? {
          source_type: root.source_type as EvidenceSourceType,
          source_platform: (root.source_platform as string | null) ?? null,
          source_program: (root.source_program as string | null) ?? null,
          source_url: (root.source_url as string | null) ?? null,
        }
      : undefined;

  try {
    await registerEvidenceFile(supabase, {
      id: evidenceId,
      caseId,
      userId,
      storagePath: path,
      originalFilename,
      mimeType: mime,
      fileSize: file.size,
      contentSha256,
      processingStatus: "accepted",
      ...(sourcePayload ? { source: sourcePayload } : {}),
      derivedFromEvidenceId: rootId,
      derivativeIndex: nextIdx,
      ...(audit
        ? {
            audit: {
              uploaderIp: audit.uploaderIp,
              userAgent: audit.userAgent,
              uploadMethod: "derivative_crop",
            },
          }
        : {}),
    });
  } catch (e) {
    await supabase.storage.from(EVIDENCE_BUCKET).remove([path]);
    throw e;
  }

  await copyCaseMembershipsForDerivative(supabase, sourceEvidenceId, evidenceId);

  try {
    await logActivity(supabase, {
      caseId,
      actorId: userId,
      actorLabel: "Analyst",
      action: "evidence.derivative_created",
      entityType: "evidence_file",
      entityId: evidenceId,
      payload: {
        derived_from_root_id: rootId,
        source_evidence_id: sourceEvidenceId,
        derivative_index: nextIdx,
        original_filename: originalFilename,
      },
    });
  } catch {
    /* non-blocking */
  }

  return { id: evidenceId };
}

const MAX_PDF_PAGES_PER_REQUEST = 100;

export async function assertEvidenceLinkedToCase(
  supabase: AppSupabaseClient,
  evidenceId: string,
  caseId: string,
) {
  const { data: ev, error: evErr } = await supabase
    .from("evidence_files")
    .select("case_id")
    .eq("id", evidenceId)
    .maybeSingle();
  if (evErr) throw new Error(evErr.message);
  if ((ev?.case_id as string | null) === caseId) return;
  const { data: row, error: mErr } = await supabase
    .from("evidence_case_memberships")
    .select("case_id")
    .eq("evidence_file_id", evidenceId)
    .eq("case_id", caseId)
    .maybeSingle();
  if (mErr) {
    if (isEvidenceCaseMembershipTableError(mErr)) {
      throw new Error("Cannot verify case link for stack membership (memberships unavailable).");
    }
    throw new Error(mErr.message);
  }
  if (!row) {
    throw new Error("This evidence is not linked to the selected case.");
  }
}

async function addEvidenceFileToCluster(
  supabase: AppSupabaseClient,
  input: { clusterId: string; caseId: string; evidenceFileId: string },
) {
  const { data: cl, error: cErr } = await supabase
    .from("evidence_clusters")
    .select("id")
    .eq("id", input.clusterId)
    .eq("case_id", input.caseId)
    .maybeSingle();
  if (cErr) throw new Error(cErr.message);
  if (!cl) throw new Error("Stack not found for this case.");
  const { error: insErr } = await supabase.from("evidence_cluster_members").insert({
    cluster_id: input.clusterId,
    evidence_file_id: input.evidenceFileId,
  });
  if (insErr?.code === "23505") return;
  if (insErr) throw new Error(insErr.message);
}

/**
 * Extracts one or more pages as separate PDF evidence rows (storage objects). The source PDF bytes are never modified.
 * Provenance: `derived_from_evidence_id` → chain root, `derivative_index` sequence, `derivative_source_page` = page #.
 */
export async function ingestPdfPageDerivatives(
  supabase: AppSupabaseClient,
  input: {
    sourceEvidenceId: string;
    userId: string;
    pageNumbers: number[];
    clusterId?: string | null;
    caseIdForCluster?: string | null;
    audit?: { uploaderIp?: string | null; userAgent?: string | null };
  },
): Promise<{ created: { id: string; page: number }[] }> {
  const { sourceEvidenceId, userId, pageNumbers, clusterId, caseIdForCluster, audit } = input;

  const uniqueSorted = [...new Set(pageNumbers.map((n) => Math.floor(Number(n))))]
    .filter((n) => Number.isFinite(n) && n >= 1)
    .sort((a, b) => a - b);
  if (uniqueSorted.length === 0) {
    throw new Error("Select at least one valid page number.");
  }
  if (uniqueSorted.length > MAX_PDF_PAGES_PER_REQUEST) {
    throw new Error(`At most ${MAX_PDF_PAGES_PER_REQUEST} pages per request.`);
  }

  if (clusterId) {
    if (!caseIdForCluster) {
      throw new Error("caseId is required when adding to a stack.");
    }
    await assertEvidenceLinkedToCase(supabase, sourceEvidenceId, caseIdForCluster);
  }

  const { data: src, error: srcErr } = await supabase
    .from("evidence_files")
    .select(
      "id, case_id, derived_from_evidence_id, original_filename, mime_type, storage_path, source_type, source_platform, source_program, source_url",
    )
    .eq("id", sourceEvidenceId)
    .maybeSingle();
  if (srcErr || !src) throw new Error("Source evidence not found");

  const mime = (src.mime_type as string | null) ?? "";
  const name = (src.original_filename as string) ?? "";
  const isPdf = mime.includes("pdf") || name.toLowerCase().endsWith(".pdf");
  if (!isPdf) throw new Error("Source file is not a PDF.");

  const storagePath = src.storage_path as string;
  const { data: fileBlob, error: dlErr } = await supabase.storage.from(EVIDENCE_BUCKET).download(storagePath);
  if (dlErr || !fileBlob) {
    throw new Error(dlErr?.message ?? "Could not read source PDF from storage.");
  }

  const srcBytes = Buffer.from(await fileBlob.arrayBuffer());
  let pdfDoc: Awaited<ReturnType<typeof PDFDocument.load>>;
  try {
    pdfDoc = await PDFDocument.load(srcBytes);
  } catch {
    throw new Error("Could not parse PDF bytes.");
  }
  const pageCount = pdfDoc.getPageCount();
  for (const p of uniqueSorted) {
    if (p > pageCount) {
      throw new Error(`Page ${p} is out of range (this PDF has ${pageCount} page(s)).`);
    }
  }

  const rootId = (src.derived_from_evidence_id as string | null) ?? (src.id as string);
  const { data: root, error: rootErr } = await supabase
    .from("evidence_files")
    .select("id, original_filename, source_type, source_platform, source_program, source_url")
    .eq("id", rootId)
    .maybeSingle();
  if (rootErr || !root) throw new Error("Root evidence not found");

  const sourcePayload: EvidenceSourcePayload | undefined =
    root.source_type != null
      ? {
          source_type: root.source_type as EvidenceSourceType,
          source_platform: (root.source_platform as string | null) ?? null,
          source_program: (root.source_program as string | null) ?? null,
          source_url: (root.source_url as string | null) ?? null,
        }
      : undefined;

  const caseId = (src.case_id as string | null) ?? null;
  const created: { id: string; page: number }[] = [];

  for (const pageOneBased of uniqueSorted) {
      const nextIdx = await getNextDerivativeIndex(supabase, rootId);
      const originalFilename = buildPdfPageOriginalFilename(root.original_filename as string, pageOneBased);

      const outDoc = await PDFDocument.create();
      const [copied] = await outDoc.copyPages(pdfDoc, [pageOneBased - 1]);
      outDoc.addPage(copied);
      const outBytes = Buffer.from(await outDoc.save());
      const fileSize = outBytes.length;
      const contentSha256 = sha256Hex(outBytes);

      const dup = await findDuplicateEvidence(supabase, {
        contentSha256,
        originalFilename,
        fileSize,
        uploadedByUserId: userId,
      });
      if (dup) {
        throw new EvidenceDuplicateError(
          `A page extract already exists for this content (page ${pageOneBased}).`,
          dup,
        );
      }

      try {
        assertEvidenceUploadAllowed({
          buffer: outBytes,
          originalFilename,
          mimeType: "application/pdf",
          declaredSize: fileSize,
        });
      } catch (e) {
        if (e instanceof UploadPolicyError) {
          await logRejectedUpload(supabase, {
            caseId,
            userId,
            filename: originalFilename,
            reason: e.message,
            kind: "policy",
          });
        }
        throw e;
      }

      const scan = await scanEvidenceBuffer({
        buffer: outBytes,
        filename: originalFilename,
        mimeType: "application/pdf",
      });
      if (!scan.clean) {
        await logRejectedUpload(supabase, {
          caseId,
          userId,
          filename: originalFilename,
          reason: scan.detail,
          kind: "scan",
        });
        throw new EvidenceScanBlockedError(
          scan.detail || "Extracted page failed the security scan and was not stored.",
        );
      }

      const evidenceId = crypto.randomUUID();
      const path = buildStoragePath(caseId, userId, evidenceId, originalFilename);
      const { error: upErr } = await supabase.storage
        .from(EVIDENCE_BUCKET)
        .upload(path, outBytes, { contentType: "application/pdf" });

      if (upErr) {
        throw new Error(upErr.message);
      }

      try {
        await registerEvidenceFile(supabase, {
          id: evidenceId,
          caseId,
          userId,
          storagePath: path,
          originalFilename,
          mimeType: "application/pdf",
          fileSize,
          contentSha256,
          processingStatus: "accepted",
          ...(sourcePayload ? { source: sourcePayload } : {}),
          derivedFromEvidenceId: rootId,
          derivativeIndex: nextIdx,
          derivativeSourcePage: pageOneBased,
          ...(audit
            ? {
                audit: {
                  uploaderIp: audit.uploaderIp,
                  userAgent: audit.userAgent,
                  uploadMethod: "derivative_pdf_page",
                },
              }
            : {}),
        });
      } catch (e) {
        await supabase.storage.from(EVIDENCE_BUCKET).remove([path]);
        throw e;
      }

      await copyCaseMembershipsForDerivative(supabase, sourceEvidenceId, evidenceId);

      if (clusterId && caseIdForCluster) {
        await addEvidenceFileToCluster(supabase, {
          clusterId,
          caseId: caseIdForCluster,
          evidenceFileId: evidenceId,
        });
      }

      try {
        await logActivity(supabase, {
          caseId,
          actorId: userId,
          actorLabel: "Analyst",
          action: "evidence.derivative_created",
          entityType: "evidence_file",
          entityId: evidenceId,
          payload: {
            kind: "pdf_page",
            derived_from_root_id: rootId,
            source_evidence_id: sourceEvidenceId,
            derivative_index: nextIdx,
            source_page: pageOneBased,
            original_filename: originalFilename,
            cluster_id: clusterId ?? null,
          },
        });
      } catch {
        /* non-blocking */
      }

      created.push({ id: evidenceId, page: pageOneBased });
  }

  return { created };
}
