import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DashboardCommandHub } from "@/components/dashboard-command-hub";
import { Button } from "@/components/ui/button";
import { getGuestSessionIdFromCookies } from "@/lib/guest-session";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const guestId = await getGuestSessionIdFromCookies();

  if (!user && !guestId) {
    return null;
  }

  if (!user && guestId) {
    return (
      <div className="mx-auto w-full max-w-3xl px-2 py-4 sm:px-0">
        <div className="rounded-xl border border-sky-400/20 bg-gradient-to-br from-[#1a2332] via-[#151c28] to-[#0f141d] p-5 shadow-[0_0_32px_-14px_rgba(56,189,248,0.18)]">
          <h1 className="text-xl font-semibold tracking-tight text-slate-50">Command Center</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            You’re browsing as a guest. Use the evidence library to upload and review files, or sign in for cases and
            saved progress.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              asChild
              size="sm"
              className="h-8 border-sky-400/40 bg-sky-500/15 text-xs font-medium text-sky-50 shadow-[0_0_20px_-8px_rgba(56,189,248,0.45)] hover:bg-sky-500/25"
            >
              <Link href="/evidence">Evidence Library</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 border-slate-500/60 bg-slate-900/50 text-xs text-slate-100 hover:bg-slate-800/80"
            >
              <Link href="/login">Sign in</Link>
            </Button>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="h-8 border-slate-500/60 bg-slate-900/50 text-xs text-slate-100 hover:bg-slate-800/80"
            >
              <Link href="/signup">Create account</Link>
            </Button>
          </div>
          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            Guest usage may be logged with technical identifiers (such as IP address and browser or device metadata) for
            security, moderation, and evidence integrity. Signing in links activity to your account.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[min(100%,88rem)] px-1 py-2 sm:px-0 sm:py-4">
      <DashboardCommandHub />
    </div>
  );
}
