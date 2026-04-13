/** HttpOnly cookie set by POST /api/guest/session — holds guest_sessions.id (UUID). */
export const GUEST_SESSION_COOKIE = "cia_guest_session";

/** Loose UUID shape (matches crypto.randomUUID output). */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isGuestSessionIdFormat(value: string | undefined | null): boolean {
  if (!value || typeof value !== "string") return false;
  return UUID_RE.test(value.trim());
}

export function parseGuestSessionIdFromCookieStore(
  cookies: { get: (name: string) => { value: string } | undefined },
): string | null {
  const raw = cookies.get(GUEST_SESSION_COOKIE)?.value;
  if (!raw || !isGuestSessionIdFormat(raw)) return null;
  return raw.trim();
}

/** Next.js `cookies()` in Route Handlers / Server Components. */
export async function getGuestSessionIdFromCookies(): Promise<string | null> {
  const { cookies } = await import("next/headers");
  const store = await cookies();
  return parseGuestSessionIdFromCookieStore(store);
}

export function parseGuestSessionIdFromRequestCookies(request: {
  cookies: { get: (name: string) => { value: string } | undefined };
}): string | null {
  return parseGuestSessionIdFromCookieStore(request.cookies);
}
