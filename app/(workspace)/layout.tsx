import type { ReactNode } from "react";
import Link from "next/link";
import { WorkspaceMainNav } from "@/components/workspace-main-nav";
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
      /** Keep initial chat payload small for RSC (messages load more via client refresh). */
      chatMessages = await listRecentDashboardChat(supabase, 45);
    } catch {
      chatMessages = [];
    }
    const chatAuthorIds = [...new Set(chatMessages.map((m) => m.user_id).filter(Boolean))] as string[];
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
        <div className="grid h-14 w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-4">
          <div className="flex min-w-0 items-center justify-self-start">
            <div className="flex shrink-0 flex-col gap-0.5">
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
          </div>

          <WorkspaceMainNav showInvestigators={Boolean(user)} />

          <div className="flex min-w-0 items-center justify-end justify-self-end gap-2">
            {user ? <NotificationsBell userId={user.id} /> : null}
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