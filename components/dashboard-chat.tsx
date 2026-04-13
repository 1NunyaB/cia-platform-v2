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
};

export function DashboardChat({ initialMessages, profiles }: Props) {
  const [pinned, setPinned] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
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
    const data = (await res.json()) as { messages: DashboardChatMessageRow[] };
    setMessages(data.messages);
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
        const data = (await res.json()) as { messages: DashboardChatMessageRow[] };
        setMessages(data.messages);
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
      return;
    }
    setBody("");
    await refresh();
  }

  return (
    <Card
      className={cn(
        "border-border bg-white text-foreground shadow-sm",
        pinned && "xl:sticky xl:top-4 xl:z-10 ring-1 ring-sky-400/90",
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div>
          <CardTitle className="text-base text-foreground">Workspace chat</CardTitle>
          <CardDescription className="text-xs text-muted-foreground leading-relaxed">
            Saved for all signed-in members — not case notes. Search matches message text. Automated checks reduce spam,
            floods, and duplicate posts.{" "}
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
          </CardDescription>
        </div>
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
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search chat history…"
              className="h-9 pl-8 text-sm bg-form-field text-foreground border-input"
              aria-label="Search workspace chat"
            />
          </div>
          <span className="text-[10px] text-muted-foreground sm:shrink-0">
            {search.trim().length >= 2 ? "Searching saved messages" : "Showing latest thread"}
          </span>
        </div>
        {error ? <p className="text-sm text-alert-foreground font-medium">{error}</p> : null}
        <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-panel p-2 space-y-2 text-sm">
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              {search.trim().length >= 2
                ? "No messages match — try different words or clear search."
                : "No messages yet — say hello."}
            </p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="border-b border-border pb-2 last:border-0">
                <p className="text-[10px] text-muted-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  {m.author_id ? (
                    <AuthorPersonaLine profile={profiles[m.author_id]} fallbackId={m.author_id} />
                  ) : (
                    <span className="text-foreground">{m.author_label ?? "Analyst"}</span>
                  )}
                  <span>· {new Date(m.created_at).toLocaleString()}</span>
                </p>
                <p className="text-foreground whitespace-pre-wrap">{m.body}</p>
              </div>
            ))
          )}
          <div ref={listEndRef} />
        </div>
        <form onSubmit={send} className="space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, DASHBOARD_CHAT_MAX_LEN))}
            rows={2}
            placeholder="Quick message to the workspace…"
            className="text-sm min-h-[2.5rem] bg-form-field text-foreground border-input"
          />
          <div className="flex justify-between items-center gap-2">
            <span className="text-[10px] text-muted-foreground">
              {body.length}/{DASHBOARD_CHAT_MAX_LEN}
            </span>
            <Button type="submit" size="sm" disabled={loading || !body.trim()}>
              {loading ? "Sending…" : "Send"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
