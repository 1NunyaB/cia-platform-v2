import type { ExtractionMethod } from "@/types";

const MAX_PDF_OCR_PAGES = 12;
const PDF_RENDER_SCALE = 1.75;

export type OcrPageResult = {
  pageNumber: number | null;
  frameRef: string;
  text: string;
  confidence: number | null;
  rawMeta: Record<string, unknown>;
};

/**
 * Run Tesseract on a raster image buffer (PNG/JPEG/WebP/GIF).
 * Confidence is included when the engine returns a numeric value.
 */
export async function runTesseractOnImageBuffer(buffer: Buffer): Promise<{ text: string; confidence: number | null }> {
  const Tesseract = (await import("tesseract.js")).default;
  const result = await Tesseract.recognize(buffer, "eng", {
    logger: () => {},
  });
  const text = (result.data.text ?? "").trim();
  const c = result.data as { confidence?: number };
  const confidence = typeof c.confidence === "number" && !Number.isNaN(c.confidence) ? c.confidence : null;
  return { text, confidence };
}

async function tryRenderPdfPagesToPngBuffers(buffer: Buffer): Promise<Buffer[] | null> {
  try {
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const { createCanvas } = await import("canvas");

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      useSystemFonts: true,
    });
    const pdf = await loadingTask.promise;
    const n = Math.min(pdf.numPages, MAX_PDF_OCR_PAGES);
    const images: Buffer[] = [];

    for (let pageNum = 1; pageNum <= n; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: PDF_RENDER_SCALE });
      const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height));
      await page
        .render({
          canvas: canvas as unknown as HTMLCanvasElement,
          viewport,
        })
        .promise;
      images.push(canvas.toBuffer("image/png"));
    }
    return images;
  } catch (e) {
    console.warn("[ocr] PDF rasterization failed (scanned PDF OCR skipped):", e);
    return null;
  }
}

/**
 * OCR each rendered PDF page.
 */
export async function runOcrOnScannedPdfBuffer(buffer: Buffer): Promise<OcrPageResult[]> {
  const pngs = await tryRenderPdfPagesToPngBuffers(buffer);
  if (!pngs?.length) return [];

  const out: OcrPageResult[] = [];
  for (let i = 0; i < pngs.length; i++) {
    const pageNumber = i + 1;
    try {
      const { text, confidence } = await runTesseractOnImageBuffer(pngs[i]!);
      out.push({
        pageNumber,
        frameRef: `pdf:page:${pageNumber}`,
        text,
        confidence,
        rawMeta: { engine: "tesseract.js", source: "pdf_raster", page: pageNumber },
      });
    } catch (e) {
      console.warn(`[ocr] page ${pageNumber} OCR failed:`, e);
      out.push({
        pageNumber,
        frameRef: `pdf:page:${pageNumber}`,
        text: "",
        confidence: null,
        rawMeta: { engine: "tesseract.js", error: String(e) },
      });
    }
  }
  return out;
}

export function combineOcrText(pages: OcrPageResult[]): string {
  const parts: string[] = [];
  for (const p of pages) {
    const header =
      p.pageNumber != null ? `\n\n--- Page ${p.pageNumber} ---\n\n` : `\n\n--- Frame ${p.frameRef} ---\n\n`;
    if (p.text.trim()) parts.push(header + p.text.trim());
  }
  return parts.join("").trim();
}

/**
 * Server-side OCR only when text layer is absent (caller handles plain_text / pdf_text).
 * Does not touch the database — persist via `replaceExtractedTextsForEvidence`.
 *
 * Future: swap internals for an async worker queue without changing the ingest contract.
 */
export async function runEvidenceOcrPipeline(
  buffer: Buffer,
  mimeType: string | null,
  priorMethod: ExtractionMethod,
  priorText: string,
): Promise<{ text: string; method: ExtractionMethod; pages: OcrPageResult[] }> {
  const mt = (mimeType ?? "").toLowerCase();
  const pages: OcrPageResult[] = [];

  try {
    if (mt.startsWith("image/")) {
      const { text, confidence } = await runTesseractOnImageBuffer(buffer);
      pages.push({
        pageNumber: 1,
        frameRef: "image:1",
        text,
        confidence,
        rawMeta: { engine: "tesseract.js", mime: mt },
      });
      const combined = combineOcrText(pages);
      return { text: combined, method: "ocr", pages };
    }

    if (mt.includes("pdf") && priorMethod === "ocr_pending" && !priorText.trim()) {
      const pdfPages = await runOcrOnScannedPdfBuffer(buffer);
      if (pdfPages.length === 0) {
        return { text: priorText, method: "ocr_pending", pages: [] };
      }
      const combined = combineOcrText(pdfPages);
      return { text: combined, method: "ocr", pages: pdfPages };
    }
  } catch (e) {
    console.warn("[ocr] runEvidenceOcrPipeline failed:", e);
  }

  return { text: priorText, method: priorMethod, pages: [] };
}
