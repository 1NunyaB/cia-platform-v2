import type { AppSupabaseClient } from "@/types";
import type { ExtractionMethod } from "@/types";

/** page_number 0 = full-document text layer; 1..N = per-page OCR. */
export type ExtractedTextInsert = {
  page_number: number;
  raw_text: string;
  extraction_method: ExtractionMethod;
  confidence?: number | null;
};

/**
 * Replace all extracted_texts rows for a file (idempotent re-run).
 * Call after successful text layer or OCR so pages never duplicate.
 */
export async function replaceExtractedTextsForEvidence(
  supabase: AppSupabaseClient,
  evidenceFileId: string,
  rows: ExtractedTextInsert[],
): Promise<void> {
  const { error: delErr } = await supabase.from("extracted_texts").delete().eq("evidence_file_id", evidenceFileId);
  if (delErr) throw new Error(delErr.message);

  if (rows.length === 0) return;

  const payload = rows.map((r) => ({
    evidence_file_id: evidenceFileId,
    page_number: r.page_number,
    raw_text: r.raw_text,
    extraction_method: r.extraction_method,
    confidence: r.confidence ?? null,
  }));

  const { error: insErr } = await supabase.from("extracted_texts").insert(payload);
  if (insErr) throw new Error(insErr.message);
}
