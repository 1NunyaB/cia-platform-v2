import { NextResponse } from "next/server";
import { GUEST_SESSION_COOKIE } from "@/lib/guest-session";
import { tryCreateServiceClient } from "@/lib/supabase/service";
import { insertGuestSession } from "@/services/guest-session-service";
import { logUsageEvent } from "@/services/usage-log-service";
import { requestClientIp, requestUserAgent } from "@/lib/request-audit";

export const runtime = "nodejs";

const COOKIE_MAX_AGE_SEC = 60 * 60 * 24 * 90;

/**
 * Creates a guest session (anonymous) and sets HttpOnly cookie `cia_guest_session`.
 */
export async function POST(request: Request) {
  const service = tryCreateServiceClient();
  if (!service) {
    return NextResponse.json({ error: "Server storage is not configured." }, { status: 503 });
  }

  const ip = requestClientIp(request);
  const ua = requestUserAgent(request);

  try {
    const id = await insertGuestSession(service, { ipAddress: ip, userAgent: ua });
    await logUsageEvent({ guestSessionId: id, action: "guest.session_created", meta: { ip, ua } });

    const res = NextResponse.json({ guest_session_id: id }, { status: 201 });
    res.cookies.set(GUEST_SESSION_COOKIE, id, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SEC,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not start guest session";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
