import type { CaseMemberRole } from "@/types";

/** Matches `can_write_case`: creator or owner/admin/contributor member (not viewer). */
export function userCanEditCaseDetails(
  userId: string | null | undefined,
  caseRow: { created_by: string | null },
  members: { user_id: string; role: string }[],
): boolean {
  if (!userId) return false;
  if (caseRow.created_by === userId) return true;
  const m = members.find((x) => x.user_id === userId);
  if (!m) return false;
  const r = m.role as CaseMemberRole;
  return r === "owner" || r === "admin" || r === "contributor";
}
