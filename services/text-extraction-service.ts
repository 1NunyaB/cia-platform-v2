import type { AppSupabaseClient } from "@/types";
import type { ExtractionMethod } from "@/types";
import { updateEvidenceStatus } from "@/services/evidence-service";

/**
 * Extract text from raw bytes (called after downloading from Storage).
 * PDF + plain text supported; other types → ocr_pending (TODO: wire OCR provider).
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
 * Download from Storage, extract text, upsert extracted_texts, update evidence status.
 */
export async function extractTextForEvidence(
  supabase: AppSupabaseClient,
  evidenceId: string,
  mimeType: string | null,
) {
  await updateEvidenceStatus(supabase, evidenceId, "extracting");

  const { data: row, error: evErr } = await supabase
    .from("evidence_files")
    .select("storage_path")
    .eq("id", evidenceId)
    .single();
  if (evErr) throw new Error(evErr.message);

  const { EVIDENCE_BUCKET } = await import("@/services/evidence-service");
  const { data: blob, error: dlErr } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .download(row!.storage_path as string);
  if (dlErr) {
    await updateEvidenceStatus(supabase, evidenceId, "error", dlErr.message);
    throw new Error(dlErr.message);
  }

  const buffer = Buffer.from(await blob.arrayBuffer());

  try {
    const { method, text } = await extractTextFromBuffer(buffer, mimeType);
    const raw =
      method === "ocr_pending"
        ? text ||
          "[No text extracted — TODO: connect OCR for scanned PDFs/images. See services/text-extraction-service.ts]"
        : text;

    const { error: upErr } = await supabase.from("extracted_texts").upsert(
      {
        evidence_file_id: evidenceId,
        raw_text: raw,
        extraction_method: method,
      },
      { onConflict: "evidence_file_id" },
    );
    if (upErr) throw new Error(upErr.message);

    await updateEvidenceStatus(supabase, evidenceId, "complete");
    return { method, text: raw };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Extraction failed";
    await updateEvidenceStatus(supabase, evidenceId, "error", msg);
    throw e;
  }
}
