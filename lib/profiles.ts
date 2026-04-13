import type { AppSupabaseClient } from "@/types";

export type ProfileWithInvestigator = {
  display_name: string | null;
  investigator_opt_in?: boolean | null;
  investigator_alias?: string | null;
  investigator_avatar_url?: string | null;
  investigator_tagline?: string | null;
};

export async function fetchProfilesByIds(supabase: AppSupabaseClient, ids: string[]) {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return {} as Record<string, ProfileWithInvestigator>;
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, investigator_opt_in, investigator_alias, investigator_avatar_url, investigator_tagline",
    )
    .in("id", unique);
  if (error) throw new Error(error.message);
  return Object.fromEntries(
    (data ?? []).map((p) => [
      p.id,
      {
        display_name: p.display_name as string | null,
        investigator_opt_in: p.investigator_opt_in as boolean | null | undefined,
        investigator_alias: p.investigator_alias as string | null | undefined,
        investigator_avatar_url: p.investigator_avatar_url as string | null | undefined,
        investigator_tagline: p.investigator_tagline as string | null | undefined,
      },
    ]),
  ) as Record<string, ProfileWithInvestigator>;
}
