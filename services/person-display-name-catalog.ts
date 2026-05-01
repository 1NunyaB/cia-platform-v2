import { resolveFreeformCatalogLabel } from "@/lib/freeform-catalog-label";
import type { AppSupabaseClient } from "@/types";

export type PersonDisplayNameRow = { id: string; label: string; normalized: string };

function escapeIlike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_%");
}

export async function resolveAndEnsurePersonDisplayName(
  supabase: AppSupabaseClient,
  raw: string | null | undefined,
): Promise<string | null> {
  const s = raw?.trim();
  if (!s) return null;

  const { label, normalized } = resolveFreeformCatalogLabel(s);
  if (!normalized) return null;

  const { data: existing } = await supabase
    .from("person_display_names")
    .select("label")
    .eq("normalized", normalized)
    .maybeSingle();
  if (existing) return existing.label as string;

  const { error } = await supabase.from("person_display_names").insert({ label, normalized });
  if (!error) return label;

  const { data: race } = await supabase
    .from("person_display_names")
    .select("label")
    .eq("normalized", normalized)
    .maybeSingle();
  if (race) return race.label as string;

  throw new Error(error.message);
}

export async function searchPersonDisplayNames(
  supabase: AppSupabaseClient,
  query: string,
  limit = 40,
): Promise<PersonDisplayNameRow[]> {
  const q = query.trim();
  const esc = escapeIlike(q);

  if (!q) {
    const { data, error } = await supabase
      .from("person_display_names")
      .select("id, label, normalized")
      .order("label", { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as PersonDisplayNameRow[];
  }

  const { normalized: normKey } = resolveFreeformCatalogLabel(q);
  const { data: byLabel, error: e1 } = await supabase
    .from("person_display_names")
    .select("id, label, normalized")
    .ilike("label", `%${esc}%`)
    .order("label", { ascending: true })
    .limit(limit);
  if (e1) throw new Error(e1.message);

  const map = new Map<string, PersonDisplayNameRow>();
  if (normKey) {
    const { data: byNorm } = await supabase
      .from("person_display_names")
      .select("id, label, normalized")
      .eq("normalized", normKey)
      .maybeSingle();
    if (byNorm) map.set(byNorm.id as string, byNorm as PersonDisplayNameRow);
  }
  for (const r of byLabel ?? []) {
    map.set(r.id as string, r as PersonDisplayNameRow);
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label)).slice(0, limit);
}
