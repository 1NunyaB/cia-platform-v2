/**
 * When true, analysis uses extended media/OCR/transcript doctrine and expects `media_analysis` in JSON output.
 */
export function isMediaAnalysisContext(input: {
  mimeType: string | null | undefined;
  extractionMethod: string | null | undefined;
}): boolean {
  const m = (input.mimeType ?? "").toLowerCase();
  if (m.startsWith("image/") || m.startsWith("video/") || m.startsWith("audio/")) {
    return true;
  }
  if (input.extractionMethod === "ocr_pending") {
    return true;
  }
  return false;
}
