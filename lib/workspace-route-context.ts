/**
 * Derives sidebar / notes context from the current pathname (App Router).
 * Used client-side with `usePathname()` — no extra server round-trips.
 */

/** Matches typical Supabase `uuid` primary keys in URLs. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string | undefined): s is string {
  return !!s && UUID_RE.test(s.trim());
}

export type WorkspaceRouteContext = {
  /** Investigation id when URL is under `/cases/[caseId]/…` (excludes `/cases/new`). */
  caseId: string | null;
  /** Evidence id when URL is a single-evidence view. */
  evidenceId: string | null;
  /** In-app path suitable for markdown links and `<Link href>`. */
  evidenceLinkPath: string | null;
};

/**
 * Parses `/cases/:caseId/…`, `/cases/:caseId/evidence/:evidenceId`, and `/evidence/:evidenceId`.
 */
export function parseWorkspaceRouteContext(pathname: string): WorkspaceRouteContext {
  const parts = pathname.split("/").filter(Boolean);

  if (parts[0] === "cases" && parts[1] && parts[1] !== "new") {
    if (!isUuid(parts[1])) {
      return { caseId: null, evidenceId: null, evidenceLinkPath: null };
    }
    const caseId = parts[1];
    if (parts[2] === "evidence" && isUuid(parts[3])) {
      const evidenceId = parts[3];
      return {
        caseId,
        evidenceId,
        evidenceLinkPath: `/cases/${caseId}/evidence/${evidenceId}`,
      };
    }
    return { caseId, evidenceId: null, evidenceLinkPath: null };
  }

  if (parts[0] === "evidence" && isUuid(parts[1])) {
    const evidenceId = parts[1];
    return {
      caseId: null,
      evidenceId,
      evidenceLinkPath: `/evidence/${evidenceId}`,
    };
  }

  return { caseId: null, evidenceId: null, evidenceLinkPath: null };
}
