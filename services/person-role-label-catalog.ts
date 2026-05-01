import { resolveFreeformCatalogLabel } from "@/lib/freeform-catalog-label";
import { platformNormalizedKey } from "@/lib/source-platform";
import type { AppSupabaseClient } from "@/types";

/** Seeded in migration `061_person_role_labels_catalog.sql`; merged into search so the picker is never empty on open. */
export const DEFAULT_PERSON_ROLE_LABELS = [
  "Victim/Accuser",
  "Accused",
  "Employee",
  "FBI Investigator",
  "Officer",
  "Witness",
  "Government Official",
  "Police Officer",
] as const;

function defaultPersonRoleLabelRows(): PersonRoleLabelRow[] {
  const out: PersonRoleLabelRow[] = [];
  for (const label of DEFAULT_PERSON_ROLE_LABELS) {
    const { label: canon, normalized } = resolveFreeformCatalogLabel(label);
    if (!normalized) continue;
    out.push({
      id: `default:${normalized}`,
      label: canon,
      normalized,
    });
  }
  return out;
}

function roleRowMatchesQuery(row: PersonRoleLabelRow, query: string): boolean {
  const t = query.trim().toLowerCase();
  if (!t) return true;
  if (row.label.toLowerCase().includes(t)) return true;
  const nk = platformNormalizedKey(query);
  return nk.length > 0 && row.normalized.includes(nk);
}

function mergePersonRoleLabelsWithDefaults(dbRows: PersonRoleLabelRow[], query: string, limit: number): PersonRoleLabelRow[] {
  const map = new Map<string, PersonRoleLabelRow>();
  for (const r of dbRows) {
    map.set(r.normalized, r);
  }
  for (const d of defaultPersonRoleLabelRows()) {
    if (!roleRowMatchesQuery(d, query)) continue;
    if (!map.has(d.normalized)) map.set(d.normalized, d);
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label)).slice(0, limit);
}

export type PersonRoleLabelRow = { id: string; label: string; normalized: string };

function escapeIlike(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_%");
}

export async function resolveAndEnsurePersonRoleLabel(
  supabase: AppSupabaseClient,
  raw: string | null | undefined,
): Promise<string | null> {
  const s = raw?.trim();
  if (!s) return null;

  const { label, normalized } = resolveFreeformCatalogLabel(s);
  if (!normalized) return null;

  const { data: existing } = await supabase
    .from("person_role_labels")
    .select("label")
    .eq("normalized", normalized)
    .maybeSingle();
  if (existing) return existing.label as string;

  const { error } = await supabase.from("person_role_labels").insert({ label, normalized });
  if (!error) return label;

  const { data: race } = await supabase
    .from("person_role_labels")
    .select("label")
    .eq("normalized", normalized)
    .maybeSingle();
  if (race) return race.label as string;

  throw new Error(error.message);
}

export async function searchPersonRoleLabels(
  supabase: AppSupabaseClient,
  query: string,
  limit = 40,
): Promise<PersonRoleLabelRow[]> {
  const q = query.trim();
  const esc = escapeIlike(q);

  if (!q) {
    const { data, error } = await supabase
      .from("person_role_labels")
      .select("id, label, normalized")
      .order("label", { ascending: true })
      .limit(limit);
    if (error) throw new Error(error.message);
    return mergePersonRoleLabelsWithDefaults((data ?? []) as PersonRoleLabelRow[], "", limit);
  }

  const { normalized: normKey } = resolveFreeformCatalogLabel(q);
  const { data: byLabel, error: e1 } = await supabase
    .from("person_role_labels")
    .select("id, label, normalized")
    .ilike("label", `%${esc}%`)
    .order("label", { ascending: true })
    .limit(limit);
  if (e1) throw new Error(e1.message);

  const map = new Map<string, PersonRoleLabelRow>();
  if (normKey) {
    const { data: byNorm } = await supabase
      .from("person_role_labels")
      .select("id, label, normalized")
      .eq("normalized", normKey)
      .maybeSingle();
    if (byNorm) map.set(byNorm.id as string, byNorm as PersonRoleLabelRow);
  }
  for (const r of byLabel ?? []) {
    map.set(r.id as string, r as PersonRoleLabelRow);
  }
  const mergedDb = [...map.values()].sort((a, b) => a.label.localeCompare(b.label)).slice(0, limit);
  return mergePersonRoleLabelsWithDefaults(mergedDb, q, limit);
}
