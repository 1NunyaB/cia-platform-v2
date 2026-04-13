import type { AppSupabaseClient } from "@/types";
import {
  mergePlatformKey,
  platformNormalizedKey,
  resolveSourcePlatformForStorage,
} from "@/lib/source-platform";

/**
 * Ensures the catalog has a row for this platform and returns the canonical display label.
 */
export async function resolveAndEnsureSourcePlatform(
  supabase: AppSupabaseClient,
  raw: string | null | undefined,
): Promise<string | null> {
  const s = raw?.trim();
  if (!s) return null;

  const { label, normalized } = resolveSourcePlatformForStorage(s);

  const { data: existing } = await supabase
    .from("source_platforms")
    .select("label")
    .eq("normalized", normalized)
    .maybeSingle();
  if (existing) return existing.label as string;

  const { error } = await supabase.from("source_platforms").insert({ label, normalized });
  if (!error) return label;

  const { data: race } = await supabase
    .from("source_platforms")
    .select("label")
    .eq("normalized", normalized)
    .maybeSingle();
  if (race) return race.label as string;

  throw new Error(error.message);
}

export type SourcePlatformRow = { id: string; label: string; normalized: string };

export async function searchSourcePlatforms(
  supabase: AppSupabaseClient,
  query: string,
  limit = 40,
): Promise<SourcePlatformRow[]> {
  const q = query.trim();
  if (!q) {
    const { data, error } = await supabase
      .from("source_platforms")
      .select("id, label, normalized")
      .order("label", { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as SourcePlatformRow[];
  }

  const k = mergePlatformKey(platformNormalizedKey(q));
  const esc = q.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_%");

  const { data: byLabel, error: e1 } = await supabase
    .from("source_platforms")
    .select("id, label, normalized")
    .ilike("label", `%${esc}%`)
    .order("label", { ascending: true })
    .limit(limit);
  if (e1) throw new Error(e1.message);

  const { data: byNorm } = await supabase
    .from("source_platforms")
    .select("id, label, normalized")
    .eq("normalized", k)
    .maybeSingle();

  const map = new Map<string, SourcePlatformRow>();
  if (byNorm) map.set(byNorm.id as string, byNorm as SourcePlatformRow);
  for (const r of byLabel ?? []) {
    map.set(r.id as string, r as SourcePlatformRow);
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label)).slice(0, limit);
}
