import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/notifications-bell";
import { GuestModeBanner } from "@/components/guest-mode-banner";
import { WorkspaceShellWithPanel } from "@/components/workspace-right-panel";
import { getGuestSessionIdFromCookies } from "@/lib/guest-session";
import { createClient } from "@/lib/supabase/server";
import { isPlatformDeleteAdmin } from "@/lib/admin-guard";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const guestSessionId = await getGuestSessionIdFromCookies();
  const notesOwnerKey =
    user?.id != null
      ? `auth:${user.id}`
      : guestSessionId != null
        ? `guest:${guestSessionId}`
        : "anon";

  let investigatorChrome: {
    alias: string;
    avatarUrl: string | null;
  } | null = null;
  if (user) {
    const { data: inv } = await supabase
      .from("profiles")
      .select("investigator_opt_in, investigator_alias, investigator_avatar_url")
      .eq("id", user.id)
      .maybeSingle();
    const alias = (inv?.investigator_alias as string | null)?.trim();
    if (inv?.investigator_opt_in && alias) {
      investigatorChrome = {
        alias,
        avatarUrl: (inv.investigator_avatar_url as string | null)?.trim() || null,
      };
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <GuestModeBanner />
      <header className="border-b border-border bg-card shadow-sm">
        <div className="flex h-14 w-full items-center justify-between gap-4">
          <nav className="flex items-center gap-4 text-sm">
            <div className="flex flex-col gap-0.5">
              <Link href="/" className="font-semibold leading-tight">
                CIS
              </Link>
              {investigatorChrome ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  {investigatorChrome.avatarUrl ? (
                    <img
                      src={investigatorChrome.avatarUrl}
                      alt=""
                      className="h-7 w-7 rounded-full border border-border object-cover"
                    />
                  ) : null}
                  <span className="max-w-[140px] truncate">{investigatorChrome.alias}</span>
                </span>
              ) : null}
            </div>
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              href="/cases"
              className="text-muted-foreground hover:text-foreground"
            >
              Cases
            </Link>
            <Link
              href="/evidence"
              className="text-muted-foreground hover:text-foreground"
            >
              Evidence
            </Link>
            <Link
              href="/media/video"
              className="text-muted-foreground hover:text-foreground"
            >
              Video
            </Link>
            <Link
              href="/media/audio"
              className="text-muted-foreground hover:text-foreground"
            >
              Audio
            </Link>
            {user ? (
              <Link
                href="/investigators"
                className="text-muted-foreground hover:text-foreground"
              >
                Investigators
              </Link>
            ) : null}
            <Link
              href="/explore"
              className="text-muted-foreground hover:text-foreground"
            >
              Public
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            {user ? <NotificationsBell /> : null}
            {!user ? (
              <Button variant="outline" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
            ) : null}
          </div>
        </div>
      </header>

      <WorkspaceShellWithPanel notesOwnerKey={notesOwnerKey} canDelete={isPlatformDeleteAdmin(user)}>
        {children}
      </WorkspaceShellWithPanel>
    </div>
  );
}