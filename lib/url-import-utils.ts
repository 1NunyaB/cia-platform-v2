/**
 * Guards for server-side URL fetch (reduce basic SSRF / internal network risk).
 */
export function parsePublicHttpUrl(urlStr: string): URL {
  const trimmed = urlStr.trim();
  if (!trimmed) {
    throw new Error("Enter a web address (URL) to import.");
  }
  let u: URL;
  try {
    u = new URL(trimmed);
  } catch {
    throw new Error("That does not look like a valid web address. Use http:// or https://.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    throw new Error("Only http and https links can be imported.");
  }
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host === "::1"
  ) {
    throw new Error("Local addresses cannot be imported.");
  }
  if (/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) {
    throw new Error("Private network addresses cannot be imported.");
  }
  return u;
}

export const MAX_IMPORT_BYTES = 15 * 1024 * 1024;

/** Strip tags for readable plain text from HTML (no DOM dependency). */
export function htmlToPlainText(html: string): string {
  const noScript = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");
  const text = noScript
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return text;
}

export function isLikelyPdfBuffer(buf: Buffer): boolean {
  return buf.length >= 5 && buf.subarray(0, 5).toString("ascii") === "%PDF-";
}
