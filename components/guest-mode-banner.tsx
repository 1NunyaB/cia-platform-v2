import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getGuestSessionIdFromCookies } from "@/lib/guest-session";

/**
 * Shown when the workspace is used with a guest cookie and no Supabase auth session.
 */
export async function GuestModeBanner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return null;

  const guestId = await getGuestSessionIdFromCookies();
  if (!guestId) return null;

  return (
    <div className="border-b border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950">
      <p className="max-w-4xl mx-auto">
        You’re using the workspace <span className="font-medium">without an account</span>. Uploads and actions in
        this session are tied to your browser cookie.{" "}
        <Link href="/login" className="underline font-medium">
          Sign in
        </Link>{" "}
        or{" "}
        <Link href="/signup" className="underline font-medium">
          create an account
        </Link>{" "}
        to keep progress in your profile. Guest usage may be logged with technical details (for example IP address and
        browser metadata) for security and evidence integrity.
      </p>
    </div>
  );
}
