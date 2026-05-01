import { resolveFreeformCatalogLabel } from "@/lib/freeform-catalog-label";
import { platformNormalizedKey } from "@/lib/source-platform";
import { US_CITIES_BY_STATE } from "@/lib/us-cities-by-state";
import type { AppSupabaseClient } from "@/types";

export type CityOptionRow = { id: string; label: string; normalized: string };

function escapeIlike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_%");
}

export async function resolveAndEnsureCityOption(
  supabase: AppSupabaseClient,
  stateCode: string,
  raw: string | null | undefined,
): Promise<string | null> {
  const sc = stateCode.trim().toUpperCase();
  if (!sc) return null;
  const s = raw?.trim();
  if (!s) return null;

  const { label, normalized } = resolveFreeformCatalogLabel(s);
  if (!normalized) return null;

  const { data: existing } = await supabase
    .from("city_options")
    .select("label")
    .eq("state_code", sc)
    .eq("normalized", normalized)
    .maybeSingle();
  if (existing) return existing.label as string;

  const { error } = await supabase.from("city_options").insert({ state_code: sc, label, normalized });
  if (!error) return label;

  const { data: race } = await supabase
    .from("city_options")
    .select("label")
    .eq("state_code", sc)
    .eq("normalized", normalized)
    .maybeSingle();
  if (race) return race.label as string;

  throw new Error(error.message);
}

export async function searchCityOptions(
  supabase: AppSupabaseClient,
  stateCode: string,
  query: string,
  limit = 50,
): Promise<CityOptionRow[]> {
  const sc = stateCode.trim().toUpperCase();
  if (!sc) return [];

  const q = query.trim();
  const esc = escapeIlike(q);

  const staticCities = US_CITIES_BY_STATE[sc] ?? [];
  const ql = q.toLowerCase();
  const staticFiltered = q
    ? staticCities.filter((c) => c.toLowerCase().includes(ql) || platformNormalizedKey(c).includes(platformNormalizedKey(q)))
    : staticCities;

  let dbReq = supabase
    .from("city_options")
    .select("id, label, normalized")
    .eq("state_code", sc)
    .order("label", { ascending: true });
  if (q) {
    dbReq = dbReq.ilike("label", `%${esc}%`);
  }
  const { data: dbRows, error } = await dbReq.limit(200);
  if (error) throw new Error(error.message);

  const map = new Map<string, CityOptionRow>();

  for (const label of staticFiltered) {
    const normalized = platformNormalizedKey(label);
    map.set(normalized, { id: `static:${normalized}`, label, normalized });
  }
  for (const r of dbRows ?? []) {
    const row = r as CityOptionRow;
    map.set(row.normalized, row);
  }

  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label)).slice(0, limit);
}
