// FIXED: use user_id instead of user_id

const ids = new Set<string>();

for (const m of messages) {
  if (new Date(m.created_at).getTime() >= cutoff && m.user_id) {
    ids.add(m.user_id as string);
  }
}