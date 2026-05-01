import { resolveFreeformCatalogLabel } from "@/lib/freeform-catalog-label";
import { platformNormalizedKey } from "@/lib/source-platform";
import type { AppSupabaseClient } from "@/types";

export type SourceProgramRow = { id: string; label: string; normalized: string };

function escapeIlike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_%");
}

export async function resolveAndEnsureSourceProgram(
  supabase: AppSupabaseClient,
  raw: string | null | undefined,
): Promise<string | null> {
  const s = raw?.trim();
  if (!s) return null;

  const { label, normalized } = resolveFreeformCatalogLabel(s);
  if (!normalized) return null;

  const { data: existing } = await supabase
    .from("source_programs")
    .select("label")
    .eq("normalized", normalized)
    .maybeSingle();
  if (existing) return existing.label as string;

  const { error } = await supabase.from("source_programs").insert({ label, normalized });
  if (!error) return label;

  const { data: race } = await supabase
    .from("source_programs")
    .select("label")
    .eq("normalized", normalized)
    .maybeSingle();
  if (race) return race.label as string;

  throw new Error(error.message);
}

export async function searchSourcePrograms(
  supabase: AppSupabaseClient,
  query: string,
  limit = 40,
): Promise<SourceProgramRow[]> {
  const q = query.trim();
  const esc = escapeIlike(q);

  if (!q) {
    const { data, error } = await supabase
      .from("source_programs")
      .select("id, label, normalized")
      .order("label", { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return (data ?? []) as SourceProgramRow[];
  }

  const k = platformNormalizedKey(q);
  const { data: byLabel, error: e1 } = await supabase
    .from("source_programs")
    .select("id, label, normalized")
    .ilike("label", `%${esc}%`)
    .order("label", { ascending: true })
    .limit(limit);
  if (e1) throw new Error(e1.message);

  const { data: byNorm } = await supabase
    .from("source_programs")
    .select("id, label, normalized")
    .eq("normalized", k)
    .maybeSingle();

  const map = new Map<string, SourceProgramRow>();
  if (byNorm) map.set(byNorm.id as string, byNorm as SourceProgramRow);
  for (const r of byLabel ?? []) {
    map.set(r.id as string, r as SourceProgramRow);
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label)).slice(0, limit);
}
