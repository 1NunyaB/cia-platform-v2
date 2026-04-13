/**
 * Normalized case title for deduplication and similarity — must stay aligned with
 * `find_case_by_normalized_title` in Supabase (trim, lowercase, collapse whitespace).
 */
export function normalizeCaseTitle(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}
