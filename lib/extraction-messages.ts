/**
 * User-visible strings for extraction outcomes — single source of truth for uploads and URL import.
 * Server-side OCR runs only after a file is stored; see `extractTextForEvidence` in text-extraction-service.
 */

/** Stored in `extracted_texts` when OCR/rasterization yields no usable text for a binary upload. */
export const EXTRACTION_NO_USABLE_TEXT_PLACEHOLDER =
  "[No text extracted — OCR could not read this file, or rasterization failed. Try a clearer scan or a text-based PDF.]";

/**
 * URL import fetches bytes once and builds a `.txt` artifact; we only pdf-parse here (no Tesseract).
 * Full OCR runs when users upload the PDF as a file (ingest → storage → `extractTextForEvidence`).
 */
export const URL_IMPORT_PDF_NO_TEXT_LAYER_PLACEHOLDER =
  "[No text extracted from PDF — no text layer in the downloaded bytes. Upload the PDF as a file for OCR.]";

/** True when stored text is empty or only a known “no usable text” placeholder (re-run OCR may help). */
export function isExtractionPlaceholderText(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  if (!t) return true;
  return t.startsWith("[No text extracted");
}
