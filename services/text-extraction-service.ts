/**
 * Text extraction runs **server-side only** (Node API route / ingest), after the file is stored
 * and registered on `evidence_files`.
 *
 * Order: download bytes → detect text layer (plain / PDF text) → else Tesseract OCR (image or
 * rendered PDF pages). Results are written to `extracted_texts` (one row per page for OCR;
 * `page_number = 0` for full-document text layer).
 *
 * **Idempotency:** If `extracted_texts` already exist and status is not `error`, extraction/OCR
 * is skipped unless `{ force: true }` is passed (avoids duplicate rows and repeated OCR cost).
 *
 * Future: replace the body of `extractTextForEvidence` with a queue consumer without changing
 * the upload → `registerEvidenceFile` → extract contract.
 */

import type { AppSupabaseClient } from "@/types";
import type { ExtractionMethod } from "@/types";
import { getExtractedText, updateEvidenceStatus } from "@/services/evidence-service";
import { runEvidenceOcrPipeline } from "@/services/ocr-service";
import { replaceExtractedTextsForEvidence } from "@/services/extracted-text-repository";
import { EXTRACTION_NO_USABLE_TEXT_PLACEHOLDER } from "@/lib/extraction-messages";

export type ExtractTextResult =
  | { ok: true; method: ExtractionMethod; text: string; skipped?: boolean }
  | { ok: false; error: string };

export type ExtractTextOptions = {
  /** Re-run OCR/text extraction even when rows exist and status is complete (e.g. `?force=1` on extract API). */
  force?: boolean;
};

/**
 * Extract text from raw bytes (called after downloading from Storage).
 * PDF with text layer → pdf_text; plain text → plain_text; otherwise OCR path when applicable.
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mimeType: string | null,
): Promise<{ method: ExtractionMethod; text: string }> {
  const mt = (mimeType ?? "").toLowerCase();

  if (mt.includes("pdf")) {
    const pdfParse = (await import("pdf-parse")).default as (
      data: Buffer,
    ) => Promise<{ text?: string }>;
    const parsed = await pdfParse(buffer);
    const text = (parsed.text ?? "").trim();
    if (!text.length) {
      return { method: "ocr_pending", text: "" };
    }
    return { method: "pdf_text", text };
  }

  if (mt.startsWith("text/") || mt === "application/json" || mt === "") {
    return { method: "plain_text", text: buffer.toString("utf8") };
  }

  return { method: "ocr_pending", text: "" };
}

/**
 * Download from Storage, extract or OCR, replace `extracted_texts` rows for this file.
 * Does not throw on extraction/OCR failure — returns `{ ok: false }` and sets `evidence_files.processing_status` / `error_message`.
 * The evidence row and storage object always remain unless a caller deletes them.
 */
export async function extractTextForEvidence(
  supabase: AppSupabaseClient,
  evidenceId: string,
  mimeType: string | null,
  options?: ExtractTextOptions,
): Promise<ExtractTextResult> {
  const force = options?.force === true;

  const { data: evRow, error: evLoadErr } = await supabase
    .from("evidence_files")
    .select("storage_path, mime_type, processing_status")
    .eq("id", evidenceId)
    .single();

  if (evLoadErr) {
    const msg = evLoadErr.message;
    await updateEvidenceStatus(supabase, evidenceId, "error", msg);
    return { ok: false, error: msg };
  }

  const effectiveMime = mimeType ?? (evRow!.mime_type as string | null);
  const status = evRow!.processing_status as string;

  if (!force) {
    if (status !== "error") {
      const { count, error: cErr } = await supabase
        .from("extracted_texts")
        .select("*", { count: "exact", head: true })
        .eq("evidence_file_id", evidenceId);
      if (cErr) {
        await updateEvidenceStatus(supabase, evidenceId, "error", cErr.message);
        return { ok: false, error: cErr.message };
      }
      if ((count ?? 0) > 0) {
        const merged = await getExtractedText(supabase, evidenceId);
        if (merged?.raw_text != null && String(merged.raw_text).length > 0) {
          return {
            ok: true,
            method: merged.extraction_method,
            text: String(merged.raw_text),
            skipped: true,
          };
        }
      }
    }
  }

  await updateEvidenceStatus(supabase, evidenceId, "extracting");

  const { EVIDENCE_BUCKET } = await import("@/services/evidence-service");
  const { data: blob, error: dlErr } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .download(evRow!.storage_path as string);
  if (dlErr) {
    await updateEvidenceStatus(supabase, evidenceId, "error", dlErr.message);
    return { ok: false, error: dlErr.message };
  }

  const buffer = Buffer.from(await blob.arrayBuffer());

  try {
    const initial = await extractTextFromBuffer(buffer, effectiveMime);

    if (initial.method === "plain_text" || initial.method === "pdf_text") {
      await replaceExtractedTextsForEvidence(supabase, evidenceId, [
        {
          page_number: 0,
          raw_text: initial.text,
          extraction_method: initial.method,
        },
      ]);
      await updateEvidenceStatus(supabase, evidenceId, "complete");
      return { ok: true, method: initial.method, text: initial.text };
    }

    let ocrOut: Awaited<ReturnType<typeof runEvidenceOcrPipeline>>;
    try {
      ocrOut = await runEvidenceOcrPipeline(buffer, effectiveMime, initial.method, initial.text);
    } catch (ocrErr) {
      console.warn("[text-extraction] OCR pipeline error (file preserved):", ocrErr);
      ocrOut = { text: initial.text, method: initial.method, pages: [] };
    }

    if (ocrOut.method === "ocr" && ocrOut.pages.length > 0) {
      await replaceExtractedTextsForEvidence(
        supabase,
        evidenceId,
        ocrOut.pages.map((p) => ({
          page_number: p.pageNumber ?? 1,
          raw_text: p.text,
          extraction_method: "ocr",
          confidence: p.confidence,
        })),
      );
      await updateEvidenceStatus(supabase, evidenceId, "complete");
      return { ok: true, method: "ocr", text: ocrOut.text };
    }

    await replaceExtractedTextsForEvidence(supabase, evidenceId, [
      {
        page_number: 0,
        raw_text: EXTRACTION_NO_USABLE_TEXT_PLACEHOLDER,
        extraction_method: "ocr_pending",
      },
    ]);
    await updateEvidenceStatus(supabase, evidenceId, "complete");
    return { ok: true, method: "ocr_pending", text: EXTRACTION_NO_USABLE_TEXT_PLACEHOLDER };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Extraction failed";
    console.warn("[text-extraction]", msg, e);
    await updateEvidenceStatus(supabase, evidenceId, "error", msg);
    try {
      await replaceExtractedTextsForEvidence(supabase, evidenceId, []);
    } catch {
      /* ignore secondary failure */
    }
    return { ok: false, error: msg };
  }
}
