import type { AppSupabaseClient } from "@/types";

export async function fetchProfilesByIds(supabase: AppSupabaseClient, ids: string[]) {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return {} as Record<string, { display_name: string | null }>;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", unique);
  if (error) throw new Error(error.message);
  return Object.fromEntries((data ?? []).map((p) => [p.id, { display_name: p.display_name }]));
}
