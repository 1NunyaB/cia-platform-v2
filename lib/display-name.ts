/** Resolve a readable label for notes/comments when auth profiles are absent. */
export function authorDisplayName(
  row: { user_id?: string | null; user_label?: string | null },
  profiles: Record<string, { display_name: string | null }>,
): string {
  const label = row.user_label?.trim();
  if (label) return label;
  const id = row.user_id;
  if (id && profiles[id]?.display_name) return profiles[id].display_name ?? id;
  if (id) return id;
  return "Analyst";
}

export function actorDisplayName(
  row: { actor_id?: string | null; actor_label?: string | null },
  profiles: Record<string, { display_name: string | null }>,
): string {
  const label = row.actor_label?.trim();
  if (label) return label;
  const id = row.actor_id;
  if (id && profiles[id]?.display_name) return profiles[id].display_name ?? id;
  if (id) return id;
  return "System";
}
