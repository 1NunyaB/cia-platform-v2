import { URL_IMPORT_PDF_NO_TEXT_LAYER_PLACEHOLDER } from "@/lib/extraction-messages";
import { extractTextFromBuffer } from "@/services/text-extraction-service";
import {
  MAX_IMPORT_BYTES,
  htmlToPlainText,
  isLikelyPdfBuffer,
  parsePublicHttpUrl,
} from "@/lib/url-import-utils";

export type UrlImportResult = {
  text: string;
  extractionNote?: string;
  rawHtml?: string;
  /** For display / storage filename */
  sourceLabel: string;
};

export type UrlImportLinkCandidate = {
  url: string;
  label: string;
  isDirectDocument: boolean;
};

function safeFilenameSegment(s: string): string {
  return s.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "page";
}

function collapseBlankLines(s: string): string {
  return s
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtmlNoise(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|template|meta|link|svg|canvas|iframe)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(script|style|noscript|template|meta|link|svg|canvas|iframe)\b[^>]*\/?>/gi, " ")
    .replace(/<(nav|header|footer|aside|form)[^>]*>[\s\S]*?<\/\1>/gi, " ");
}

function extractHtmlTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = m?.[1] ? htmlToPlainText(m[1]) : "";
  return title.trim() ? title.trim() : null;
}

function extractMainHtmlBlock(cleanHtml: string): string {
  const candidates = [
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<section\b[^>]*(?:id|class)=["'][^"']*(?:content|article|post|story|body)[^"']*["'][^>]*>([\s\S]*?)<\/section>/i,
    /<div\b[^>]*(?:id|class)=["'][^"']*(?:content|article|post|story|body)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<body\b[^>]*>([\s\S]*?)<\/body>/i,
  ];
  for (const re of candidates) {
    const m = cleanHtml.match(re);
    if (m?.[1]?.trim()) return m[1];
  }
  return cleanHtml;
}

function htmlFragmentToReadableText(fragment: string): string {
  const withBreaks = fragment
    .replace(/<(h1|h2|h3|h4|h5|h6|p|li|blockquote|section|article|main|div|br)\b[^>]*>/gi, "\n")
    .replace(/<\/(h1|h2|h3|h4|h5|h6|p|li|blockquote|section|article|main|div)>/gi, "\n");
  return collapseBlankLines(htmlToPlainText(withBreaks));
}

function extractHeadingsFromHtml(fragment: string, max = 12): string[] {
  const out: string[] = [];
  const re = /<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(fragment)) && out.length < max) {
    const text = htmlToPlainText(m[1] ?? "").trim();
    if (text) out.push(text);
  }
  return out;
}

function buildExtractedPageText(input: { sourceUrl: string; html: string }): string {
  const noNoise = stripHtmlNoise(input.html);
  const title = extractHtmlTitle(noNoise);
  const main = extractMainHtmlBlock(noNoise);
  const headings = extractHeadingsFromHtml(main);
  const body = htmlFragmentToReadableText(main);
  const lines = [
    title ? `Title: ${title}` : null,
    `Source URL: ${input.sourceUrl}`,
    headings.length ? `Headings:\n${headings.map((h) => `- ${h}`).join("\n")}` : null,
    body ? `Body Text:\n${body}` : null,
  ].filter(Boolean) as string[];
  return collapseBlankLines(lines.join("\n\n"));
}

/**
 * Fetch a public URL and produce plain text suitable for evidence extraction (same downstream as uploads).
 */
export async function fetchTextFromPublicUrl(urlStr: string): Promise<UrlImportResult> {
  const u = parsePublicHttpUrl(urlStr);
  const sourceLabel = u.href;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25_000);
  let res: Response;
  try {
    res = await fetch(u.href, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/html,application/xhtml+xml,application/pdf,text/plain;q=0.9,*/*;q=0.8",
        "User-Agent": "CrowdInvestigationsAgency/1.0 (evidence URL import)",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    if (msg.includes("abort")) {
      throw new Error("The page took too long to respond. Try a smaller page or a direct file link.");
    }
    throw new Error(`Could not reach that address: ${msg}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new Error(`The server returned ${res.status} ${res.statusText || ""}`.trim());
  }

  const lenHeader = res.headers.get("content-length");
  if (lenHeader) {
    const n = parseInt(lenHeader, 10);
    if (!Number.isNaN(n) && n > MAX_IMPORT_BYTES) {
      throw new Error("That file is too large to import (max ~15 MB). Try a direct link to a smaller document.");
    }
  }

  const arrayBuf = await res.arrayBuffer();
  if (arrayBuf.byteLength > MAX_IMPORT_BYTES) {
    throw new Error("Download was too large (max ~15 MB). Try a smaller page or document.");
  }

  const buffer = Buffer.from(arrayBuf);
  const ct = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();

  if (ct.includes("application/pdf") || isLikelyPdfBuffer(buffer)) {
    const { method, text } = await extractTextFromBuffer(buffer, "application/pdf");
    const raw =
      method === "ocr_pending"
        ? text || URL_IMPORT_PDF_NO_TEXT_LAYER_PLACEHOLDER
        : text;
    if (!raw.trim()) {
      throw new Error("No readable text could be extracted from that PDF.");
    }
    return {
      text: raw,
      extractionNote:
        method === "ocr_pending"
          ? "PDF text layer missing in fetch; placeholder stored. Upload the file for server-side OCR."
          : undefined,
      sourceLabel,
    };
  }

  if (ct.includes("html") || ct.includes("xml")) {
    const html = buffer.toString("utf8");
    const text = buildExtractedPageText({ sourceUrl: sourceLabel, html });
    if (!text.trim()) {
      throw new Error("No readable text could be pulled from that page (it may be mostly images or scripts).");
    }
    return { text, sourceLabel, rawHtml: html };
  }

  if (ct.startsWith("text/") || ct === "application/json" || ct === "") {
    const text = collapseBlankLines(buffer.toString("utf8"));
    if (!text.trim()) {
      throw new Error("That page had no readable text content.");
    }
    return { text, sourceLabel };
  }

  /** Unknown type: try UTF-8 text, then HTML strip, then PDF sniff. */
  if (isLikelyPdfBuffer(buffer)) {
    const { method, text } = await extractTextFromBuffer(buffer, "application/pdf");
    const raw =
      method === "ocr_pending"
        ? text || URL_IMPORT_PDF_NO_TEXT_LAYER_PLACEHOLDER
        : text;
    if (raw.trim()) {
      return { text: raw, sourceLabel };
    }
  }

  const asUtf8 = buffer.toString("utf8");
  if (/<(html|head|body|article|main)\b/i.test(asUtf8)) {
    const extracted = buildExtractedPageText({ sourceUrl: sourceLabel, html: asUtf8 });
    if (extracted.trim()) {
      return { text: extracted, sourceLabel, rawHtml: asUtf8 };
    }
  }
  if (asUtf8.trim() && !asUtf8.includes("\0")) {
    return { text: collapseBlankLines(asUtf8), sourceLabel };
  }

  const stripped = htmlToPlainText(asUtf8);
  if (stripped.trim()) {
    return { text: stripped, sourceLabel };
  }

  throw new Error(
    `Unsupported content type for import (${ct || "unknown"}). Try a web page, PDF, or plain text link.`,
  );
}

export function buildImportFilename(u: URL): string {
  const host = safeFilenameSegment(u.hostname);
  const pathPart = u.pathname.split("/").filter(Boolean).pop() ?? "page";
  const base = safeFilenameSegment(pathPart).replace(/\.[^.]+$/, "");
  return `import-${host}-${base}-${Date.now()}.txt`;
}

function isSupportedDocLink(u: URL): boolean {
  const p = u.pathname.toLowerCase();
  return (
    p.endsWith(".pdf") ||
    p.endsWith(".txt") ||
    p.endsWith(".md") ||
    p.endsWith(".csv") ||
    p.endsWith(".json") ||
    p.endsWith(".xml")
  );
}

/** Reusable page scrubber: collect absolute document/page links for batch URL import selection. */
export async function collectImportableLinksFromPage(
  pageUrl: string,
  limit = 300,
): Promise<UrlImportLinkCandidate[]> {
  const base = parsePublicHttpUrl(pageUrl);
  const res = await fetch(base.href, {
    redirect: "follow",
    headers: {
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
      "User-Agent": "CIS/1.0 (batch link collector)",
    },
  });
  if (!res.ok) throw new Error(`Could not fetch page (${res.status})`);
  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  if (!ct.includes("html")) {
    throw new Error("Link collection expects an HTML page URL.");
  }
  const html = await res.text();
  const re = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  const out: UrlImportLinkCandidate[] = [];
  const seen = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < limit) {
    const rawHref = (m[1] ?? "").trim();
    if (!rawHref || rawHref.startsWith("#") || rawHref.startsWith("javascript:") || rawHref.startsWith("mailto:")) {
      continue;
    }
    let abs: URL;
    try {
      abs = new URL(rawHref, base);
    } catch {
      continue;
    }
    if (abs.protocol !== "http:" && abs.protocol !== "https:") continue;
    const key = abs.href;
    if (seen.has(key)) continue;
    seen.add(key);
    const anchorText = htmlToPlainText(m[2] ?? "").slice(0, 180) || safeFilenameSegment(abs.pathname.split("/").pop() ?? abs.hostname);
    out.push({
      url: key,
      label: anchorText,
      isDirectDocument: isSupportedDocLink(abs),
    });
  }
  // Prioritize direct document links first.
  return out.sort((a, b) => Number(b.isDirectDocument) - Number(a.isDirectDocument));
}
