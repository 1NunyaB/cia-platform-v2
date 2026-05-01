import { platformNormalizedKey } from "@/lib/source-platform";
import { resolveFreeformCatalogLabel } from "@/lib/freeform-catalog-label";

/**
 * Resolves a host-style label for `source_site_hosts` (dedup by normalized key).
 * Accepts bare hostnames or full URLs.
 */
export function resolveSourceSiteHostForStorage(raw: string): { label: string; normalized: string } {
  const t = raw.trim();
  if (!t) return { label: "", normalized: "" };
  try {
    let s = t;
    if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
    const u = new URL(s);
    let host = u.hostname.replace(/^www\./i, "");
    if (!host) return { label: "", normalized: "" };
    const normalized = platformNormalizedKey(host);
    if (!normalized) return { label: "", normalized: "" };
    return { label: host, normalized };
  } catch {
    return resolveFreeformCatalogLabel(t);
  }
}
