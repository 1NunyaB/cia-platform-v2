import type { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { NotificationsBell } from "@/components/notifications-bell";
import { GuestModeBanner } from "@/components/guest-mode-banner";
import { WorkspaceShellWithPanel } from "@/components/workspace-right-panel";
import { DashboardChat } from "@/components/dashboard-chat";
import { getGuestSessionIdFromCookies } from "@/lib/guest-session";
import { createClient } from "@/lib/supabase/server";
import { isPlatformDeleteAdmin } from "@/lib/admin-guard";
import { listRecentDashboardChat } from "@/services/collaboration-service";
import { fetchProfilesByIds } from "@/lib/profiles";

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

  let workspaceChatSlot: ReactNode = null;
  if (user) {
    let chatMessages: Awaited<ReturnType<typeof listRecentDashboardChat>> = [];
    try {
      chatMessages = await listRecentDashboardChat(supabase, 120);
    } catch {
      chatMessages = [];
    }
    const chatAuthorIds = [...new Set(chatMessages.map((m) => m.author_id).filter(Boolean))] as string[];
    const chatProfiles = await fetchProfilesByIds(supabase, chatAuthorIds);
    workspaceChatSlot = (
      <DashboardChat
        variant="sidebar"
        initialMessages={chatMessages}
        profiles={chatProfiles}
        currentUserId={user.id}
        isPlatformAdmin={isPlatformDeleteAdmin(user)}
      />
    );
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
              href="/analyze"
              className="text-muted-foreground hover:text-foreground"
            >
              Analyze
            </Link>
            {user ? (
              <Link
                href="/investigators"
                className="text-muted-foreground hover:text-foreground"
              >
                Investigators
              </Link>
            ) : null}
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

      <WorkspaceShellWithPanel
        notesOwnerKey={notesOwnerKey}
        canDelete={isPlatformDeleteAdmin(user)}
        chatSlot={workspaceChatSlot}
      >
        {children}
      </WorkspaceShellWithPanel>
    </div>
  );
}