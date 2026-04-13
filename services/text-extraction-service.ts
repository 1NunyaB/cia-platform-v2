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
 * Extraction failures do **not** remove the stored object: `extraction_status` / `extraction_user_message`
 * record the outcome; `processing_status` stays `accepted` or `complete` when the file itself is fine.
 */

import type { AppSupabaseClient } from "@/types";
import type { ExtractionMethod } from "@/types";
import {
  getExtractedText,
  replaceEvidenceVisualTags,
  updateEvidenceExtractionFields,
  updateEvidenceStatus,
} from "@/services/evidence-service";
import { runEvidenceOcrPipeline } from "@/services/ocr-service";
import { replaceExtractedTextsForEvidence } from "@/services/extracted-text-repository";
import { detectVisualTags } from "@/services/image-visual-tag-service";
import {
  EXTRACTION_NO_USABLE_TEXT_PLACEHOLDER,
  isExtractionPlaceholderText,
} from "@/lib/extraction-messages";

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
 * Does not throw on extraction/OCR failure — returns `{ ok: false }` and sets extraction columns.
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
    .select("storage_path, mime_type, processing_status, original_filename")
    .eq("id", evidenceId)
    .single();

  if (evLoadErr) {
    const msg = evLoadErr.message;
    await updateEvidenceExtractionFields(supabase, evidenceId, {
      extractionStatus: "failed",
      extractionUserMessage: msg,
      processingStatus: "error",
      errorMessage: msg,
    });
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
        await updateEvidenceExtractionFields(supabase, evidenceId, {
          extractionStatus: "failed",
          extractionUserMessage: cErr.message,
          processingStatus: "error",
          errorMessage: cErr.message,
        });
        return { ok: false, error: cErr.message };
      }
      if ((count ?? 0) > 0) {
        const merged = await getExtractedText(supabase, evidenceId);
        const raw = merged?.raw_text != null ? String(merged.raw_text).trim() : "";
        if (raw.length > 0 && !isExtractionPlaceholderText(raw)) {
          if (status !== "complete" && status !== "error") {
            await updateEvidenceStatus(supabase, evidenceId, "complete");
          }
          await updateEvidenceExtractionFields(supabase, evidenceId, {
            extractionStatus: "ok",
            extractionUserMessage: null,
          });
          return {
            ok: true,
            method: merged!.extraction_method,
            text: String(merged!.raw_text),
            skipped: true,
          };
        }
        /* Rows exist but text is empty or placeholder-only — run full extraction below. */
      }
    }
  }

  await updateEvidenceStatus(supabase, evidenceId, "extracting");
  await updateEvidenceExtractionFields(supabase, evidenceId, {
    extractionStatus: "pending",
    extractionUserMessage: null,
  });

  const { EVIDENCE_BUCKET } = await import("@/services/evidence-service");
  const { data: blob, error: dlErr } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .download(evRow!.storage_path as string);
  if (dlErr) {
    await updateEvidenceExtractionFields(supabase, evidenceId, {
      extractionStatus: "retry_needed",
      extractionUserMessage: dlErr.message,
      processingStatus: "accepted",
      errorMessage: null,
    });
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
      await updateEvidenceExtractionFields(supabase, evidenceId, {
        extractionStatus: "ok",
        extractionUserMessage: null,
        processingStatus: "complete",
        errorMessage: null,
      });
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
      const imageProfile = ocrOut.imageProfile;
      const isPhotoFirst =
        imageProfile === "photo_first_limited" || imageProfile === "photo_first_low_confidence";
      if ((effectiveMime ?? "").toLowerCase().startsWith("image/")) {
        const tags = detectVisualTags({
          filename: String(evRow!.original_filename ?? ""),
          ocrText: ocrOut.text,
          imageProfile: imageProfile ?? null,
        });
        try {
          await replaceEvidenceVisualTags(supabase, evidenceId, tags);
        } catch (tagErr) {
          console.warn("[text-extraction] could not persist visual tags:", tagErr);
        }
      }
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
      await updateEvidenceExtractionFields(supabase, evidenceId, {
        extractionStatus: isPhotoFirst
          ? imageProfile === "photo_first_low_confidence"
            ? "low_confidence"
            : "limited"
          : "ok",
        extractionUserMessage: isPhotoFirst
          ? imageProfile === "photo_first_low_confidence"
            ? "This appears to be primarily photo/scene evidence. OCR found only low-confidence text scraps."
            : "This appears to be primarily photo/scene evidence. OCR found limited incidental text."
          : null,
        processingStatus: "complete",
        errorMessage: null,
      });
      return { ok: true, method: "ocr", text: ocrOut.text };
    }

    await replaceExtractedTextsForEvidence(supabase, evidenceId, [
      {
        page_number: 0,
        raw_text: EXTRACTION_NO_USABLE_TEXT_PLACEHOLDER,
        extraction_method: "ocr_pending",
      },
    ]);
    if ((effectiveMime ?? "").toLowerCase().startsWith("image/")) {
      try {
        const tags = detectVisualTags({
          filename: String(evRow!.original_filename ?? ""),
          ocrText: "",
          imageProfile: "photo_first_low_confidence",
        });
        await replaceEvidenceVisualTags(supabase, evidenceId, tags);
      } catch (tagErr) {
        console.warn("[text-extraction] visual tags on low OCR image failed:", tagErr);
      }
    }
    await updateEvidenceExtractionFields(supabase, evidenceId, {
      extractionStatus: "retry_needed",
      extractionUserMessage: "No usable text from OCR for this file.",
      processingStatus: "complete",
      errorMessage: null,
    });
    return {
      ok: false,
      error: "No usable text could be extracted from this file. You can open the file and try extraction again later.",
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Extraction failed";
    console.warn("[text-extraction]", msg, e);
    await updateEvidenceExtractionFields(supabase, evidenceId, {
      extractionStatus: "failed",
      extractionUserMessage: msg,
      processingStatus: "accepted",
      errorMessage: null,
    });
    try {
      await replaceExtractedTextsForEvidence(supabase, evidenceId, []);
    } catch {
      /* ignore secondary failure */
    }
    return { ok: false, error: msg };
  }
}
