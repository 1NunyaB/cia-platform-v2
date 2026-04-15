/** Trailing `__0001` (crop chain) or `__p0001` (PDF page) stem suffix before extension. */
const STEM_SUFFIX_RE = /__(?:p\d{4}|\d{4})$/;

/** Strip trailing `__0001` / `__p0001`-style stem suffix (before extension) from an original filename. */
export function stripDerivativeStemSuffix(filename: string): string {
  const t = filename.trim();
  const lastDot = t.lastIndexOf(".");
  if (lastDot <= 0) {
    return t.replace(STEM_SUFFIX_RE, "") || t;
  }
  const stem = t.slice(0, lastDot);
  const ext = t.slice(lastDot);
  const cleanStem = stem.replace(STEM_SUFFIX_RE, "");
  return `${cleanStem}${ext}`;
}

function extensionFromFilename(name: string): string {
  const lastDot = name.lastIndexOf(".");
  if (lastDot <= 0) return "";
  return name.slice(lastDot).toLowerCase();
}

/**
 * Next derivative filename: `{rootBase}__{NNNN}{ext}` where ext comes from the uploaded crop file when possible.
 */
export function buildDerivativeOriginalFilename(
  rootOriginalFilename: string,
  nextIndex: number,
  uploadedFilename: string,
): string {
  const strippedRoot = stripDerivativeStemSuffix(rootOriginalFilename);
  const lastDot = strippedRoot.lastIndexOf(".");
  const baseStem = lastDot > 0 ? strippedRoot.slice(0, lastDot) : strippedRoot;
  const extFromRoot = lastDot > 0 ? strippedRoot.slice(lastDot) : "";
  const extFromUpload = extensionFromFilename(uploadedFilename);
  const ext = extFromUpload || extFromRoot || ".png";
  const n = Math.min(Math.max(nextIndex, 1), 9999);
  return `${baseStem}__${String(n).padStart(4, "0")}${ext}`;
}

/**
 * Single-page PDF extract from a multi-page original: `{rootStem}__p{NNNN}.pdf`.
 */
export function buildPdfPageOriginalFilename(rootOriginalFilename: string, pageNumberOneBased: number): string {
  const strippedRoot = stripDerivativeStemSuffix(rootOriginalFilename);
  const lastDot = strippedRoot.lastIndexOf(".");
  const baseStem = lastDot > 0 ? strippedRoot.slice(0, lastDot) : strippedRoot;
  const p = Math.min(Math.max(pageNumberOneBased, 1), 9999);
  return `${baseStem}__p${String(p).padStart(4, "0")}.pdf`;
}
