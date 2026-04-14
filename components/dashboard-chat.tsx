"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pin, PinOff, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardChatMessageRow } from "@/services/collaboration-service";
import { DASHBOARD_CHAT_MAX_LEN } from "@/lib/dashboard-chat-rate-limit";
import type { ProfileWithInvestigator } from "@/lib/profiles";
import { AuthorPersonaLine } from "@/components/author-persona-line";

const PIN_KEY = "cia-dashboard-chat-pinned";

type Props = {
  initialMessages: DashboardChatMessageRow[];
  profiles: Record<string, ProfileWithInvestigator>;
  currentUserId: string | null;
  isPlatformAdmin: boolean;
  /** Compact layout for the workspace right panel (below Notes). */
  variant?: "default" | "sidebar";
};

export function DashboardChat({
  initialMessages,
  profiles,
  currentUserId,
  isPlatformAdmin,
  variant = "default",
}: Props) {
  const sidebar = variant === "sidebar";
  const [pinned, setPinned] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mutedUntil, setMutedUntil] = useState<string | null>(null);
  const [mutingUserId, setMutingUserId] = useState<string | null>(null);
  const searchRef = useRef(search);
  searchRef.current = search;
  const listEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    try {
      setPinned(localStorage.getItem(PIN_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    try {
      localStorage.setItem(PIN_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const refresh = useCallback(async () => {
    const q = searchRef.current.trim();
    const url =
      q.length >= 2 ? `/api/dashboard/chat?q=${encodeURIComponent(q)}` : "/api/dashboard/chat";
    const res = await fetch(url);
    if (!res.ok) return;
    const data = (await res.json()) as {
      messages: DashboardChatMessageRow[];
      muted_until?: string | null;
    };
    setMessages(data.messages);
    setMutedUntil(data.muted_until ?? null);
  }, []);

  useEffect(() => {
    const t = setInterval(() => void refresh(), 8000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    const q = search.trim();
    const t = window.setTimeout(() => {
      void (async () => {
        const url =
          q.length >= 2 ? `/api/dashboard/chat?q=${encodeURIComponent(q)}` : "/api/dashboard/chat";
        const res = await fetch(url);
        if (!res.ok) return;
        const data = (await res.json()) as {
          messages: DashboardChatMessageRow[];
          muted_until?: string | null;
        };
        setMessages(data.messages);
        setMutedUntil(data.muted_until ?? null);
      })();
    }, 320);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeAuthors = useMemo(() => {
    const cutoff = Date.now() - 15 * 60 * 1000;
    const ids = new Set<string>();
    for (const m of messages) {
      if (new Date(m.created_at).getTime() >= cutoff && m.author_id) {
        ids.add(m.author_id as string);
      }
    }
    return [...ids];
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const t = body.trim();
    if (!t) return;
    setError(null);
    setLoading(true);
    const res = await fetch("/api/dashboard/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: t }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError((data as { error?: string }).error ?? "Failed to send");
      const muted = (data as { muted_until?: string }).muted_until;
      if (muted) setMutedUntil(muted);
      return;
    }
    setBody("");
    await refresh();
  }

  async function muteUser(targetUserId: string) {
    if (!isPlatformAdmin || !targetUserId || targetUserId === currentUserId) return;
    setError(null);
    setMutingUserId(targetUserId);
    const res = await fetch("/api/dashboard/chat/mute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: targetUserId, reason: "Workspace moderation mute (30 minutes)." }),
    });
    const data = await res.json().catch(() => ({}));
    setMutingUserId(null);
    if (!res.ok) {
      setError((data as { error?: string }).error ?? "Could not mute user.");
      return;
    }
    await refresh();
  }

  return (
    <Card
      className={cn(
        "border-border bg-white text-foreground shadow-sm",
        !sidebar && pinned && "xl:sticky xl:top-4 xl:z-10 ring-1 ring-sky-400/90",
        sidebar && "flex min-h-0 flex-1 flex-col overflow-hidden shadow-none",
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div className="min-w-0">
          <CardTitle className={cn("text-foreground", sidebar ? "text-sm" : "text-base")}>Workspace chat</CardTitle>
          <CardDescription
            className={cn("text-muted-foreground leading-relaxed", sidebar ? "text-[10px] line-clamp-3" : "text-xs")}
          >
            {sidebar ? (
              <>Signed-in workspace thread — not case notes.</>
            ) : (
              <>
                Saved for all signed-in members — not case notes. Search matches message text. Automated checks reduce
                spam, floods, and duplicate posts.{" "}
                {activeAuthors.length > 0 ? (
                  <span>
                    Active recently:{" "}
                    {activeAuthors
                      .map((id) => {
                        const p = profiles[id];
                        if (p?.investigator_opt_in && p.investigator_alias?.trim()) {
                          return p.investigator_alias.trim();
                        }
                        return p?.display_name ?? id;
                      })
                      .slice(0, 6)
                      .join(", ")}
                  </span>
                ) : (
                  <span>No recent posters in the last 15 minutes.</span>
                )}
              </>
            )}
          </CardDescription>
        </div>
        {!sidebar ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground"
            onClick={togglePin}
            title={pinned ? "Unpin" : "Pin to top while scrolling"}
          >
            {pinned ? <Pin className="h-4 w-4" /> : <PinOff className="h-4 w-4" />}
          </Button>
        ) : null}
      </CardHeader>
      <CardContent className={cn("space-y-3", sidebar && "flex min-h-0 flex-1 flex-col overflow-hidden pt-0")}>
        <div className={cn("flex flex-col gap-2", !sidebar && "sm:flex-row sm:items-center")}>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chat history…"
              className={cn(
                "pl-8 bg-form-field text-foreground border-input",
                sidebar ? "h-8 text-xs" : "h-9 text-sm",
              )}
              aria-label="Search workspace chat"
            />
          </div>
          {!sidebar ? (
            <span className="text-[10px] text-muted-foreground sm:shrink-0">
              {search.trim().length >= 2 ? "Searching saved messages" : "Showing latest thread"}
            </span>
          ) : null}
        </div>
        {error ? <p className="text-sm text-alert-foreground font-medium">{error}</p> : null}
        {mutedUntil ? (
          <p className="rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-xs text-amber-950">
            You are muted from sending messages until {new Date(mutedUntil).toLocaleTimeString()}.
          </p>
        ) : null}
        <div
          className={cn(
            "overflow-y-auto rounded-md border border-border bg-panel p-2 space-y-2 text-sm",
            sidebar ? "max-h-36 min-h-0 flex-1" : "max-h-64",
          )}
        >
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {search.trim().length >= 2
                ? "No messages match — try different words or clear search."
                : "No messages yet — say hello."}
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="border-b border-border pb-2 last:border-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    {m.author_id ? (
                      <AuthorPersonaLine profile={profiles[m.author_id]} fallbackId={m.author_id} />
                    ) : (
                      <span className="text-foreground">{m.author_label ?? "Analyst"}</span>
                    )}
                    <span>· {new Date(m.created_at).toLocaleString()}</span>
                  </p>
                  {isPlatformAdmin && m.author_id && m.author_id !== currentUserId ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-[10px] text-muted-foreground"
                      disabled={mutingUserId === m.author_id}
                      onClick={() => void muteUser(m.author_id as string)}
                    >
                      {mutingUserId === m.author_id ? "Muting…" : "Mute 30m"}
                    </Button>
                  ) : null}
                </div>
                <p className="text-foreground whitespace-pre-wrap">{m.body}</p>
              </div>
            ))
          )}
          <div ref={listEndRef} />
        </div>
        <form onSubmit={send} className={cn("space-y-2", sidebar && "shrink-0")}>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, DASHBOARD_CHAT_MAX_LEN))}
            rows={sidebar ? 2 : 2}
            placeholder="Quick message to the workspace…"
            className={cn(
              "min-h-[2.5rem] bg-form-field text-foreground border-input",
              sidebar ? "text-xs" : "text-sm",
            )}
          />
          <div className="flex justify-between items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {body.length}/{DASHBOARD_CHAT_MAX_LEN}
            </span>
            <Button type="submit" size="sm" disabled={loading || !body.trim() || Boolean(mutedUntil)}>
              {loading ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
