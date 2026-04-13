/**
 * Derive upload audit fields from an incoming Request (API routes / Route Handlers).
 * IP is best-effort behind proxies (Vercel, nginx, etc.).
 */

const MAX_USER_AGENT_LEN = 2000;

export function requestClientIp(request: Request): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 128);
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 128);
  return null;
}

export function requestUserAgent(request: Request): string | null {
  const ua = request.headers.get("user-agent");
  if (!ua) return null;
  const t = ua.trim();
  if (t.length <= MAX_USER_AGENT_LEN) return t;
  return t.slice(0, MAX_USER_AGENT_LEN);
}
