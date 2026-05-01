import { platformNormalizedKey } from "@/lib/source-platform";

/** Title-case heuristic for freeform catalog labels (cities, programs, etc.). */
function defaultLabelFromUserInput(raw: string): string {
  const t = raw.trim();
  if (!t) return t;
  if (t === t.toLowerCase() || t === t.toUpperCase()) {
    return t
      .toLowerCase()
      .split(/(\s+|\/|-)/)
      .map((part) => {
        if (/^\s+$/.test(part) || part === "/" || part === "-") return part;
        if (part.length <= 1) return part.toUpperCase();
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join("");
  }
  return t;
}

/**
 * Normalized label for generic user-extendable catalogs (no platform-specific merges).
 */
export function resolveFreeformCatalogLabel(raw: string): { label: string; normalized: string } {
  const t = raw.trim();
  if (!t) return { label: "", normalized: "" };
  const normalized = platformNormalizedKey(t);
  if (!normalized) return { label: "", normalized: "" };
  return { label: defaultLabelFromUserInput(t), normalized };
}
