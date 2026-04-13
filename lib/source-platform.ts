/**
 * Normalization + canonical labels for evidence source platform/network (dedup + display).
 * Must stay aligned with `public.source_platforms.normalized` (unique).
 */

/** Alphanumeric-only fold — "C-SPAN", "c span", "cspan" → "cspan". */
export function platformNormalizedKey(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Merge near-identical keys so obvious duplicates share one catalog row
 * (e.g. X / Twitter / x.com → `twitter`, YouTube / yt → `youtube`).
 */
export function mergePlatformKey(key: string): string {
  if (!key) return key;
  if (key === "x" || key === "twitter" || key === "xcom") return "twitter";
  if (key === "yt" || key === "youtu") return "youtube";
  if (key === "csspan" || key === "cespan") return "cspan";
  if (key === "foxnewschannel" || key === "foxnews") return "foxnews";
  if (key === "cnnnews" || key === "cnn") return "cnn";
  if (key === "thenewyorktimes" || key === "nytimes" || key === "nyt") return "newyorktimes";
  if (key === "thewashingtonpost" || key === "washpost") return "washingtonpost";
  if (key === "wsjonline" || key === "wsj") return "wsj";
  if (key === "apnews" || key === "ap") return "associatedpress";
  if (key === "reutersnews") return "reuters";
  if (key === "thewashingtonpost") return "washingtonpost";
  if (key === "thewallstreetjournal" || key === "wallstreetjournal") return "wsj";
  if (key === "theassociatedpress") return "associatedpress";
  return key;
}

/** Canonical display label for a merged normalized key (when known). */
export const CANONICAL_PLATFORM_LABEL: Record<string, string> = {
  cnn: "CNN",
  foxnews: "Fox News",
  cbsn: "CBSN",
  cspan: "C-SPAN",
  msnbc: "MSNBC",
  cnbc: "CNBC",
  abcnews: "ABC News",
  nbcnews: "NBC News",
  bbc: "BBC",
  npr: "NPR",
  pbs: "PBS",
  youtube: "YouTube",
  twitter: "X",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  linkedin: "LinkedIn",
  reddit: "Reddit",
  spotify: "Spotify",
  applepodcasts: "Apple Podcasts",
  googlepodcasts: "Google Podcasts",
  amazonmusic: "Amazon Music",
  anchor: "Anchor",
  bloomberg: "Bloomberg",
  reuters: "Reuters",
  associatedpress: "Associated Press",
  newyorktimes: "The New York Times",
  washingtonpost: "The Washington Post",
  wsj: "The Wall Street Journal",
};

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
 * Resolves the label + normalized key to store in `source_platforms` / match existing rows.
 */
export function resolveSourcePlatformForStorage(raw: string): { label: string; normalized: string } {
  const t = raw.trim();
  if (!t) return { label: "", normalized: "" };
  const k0 = platformNormalizedKey(t);
  const k = mergePlatformKey(k0);
  const canonical = CANONICAL_PLATFORM_LABEL[k];
  if (canonical) {
    return { label: canonical, normalized: k };
  }
  return { label: defaultLabelFromUserInput(t), normalized: k };
}
