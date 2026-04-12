"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Pin, PinOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardChatMessageRow } from "@/services/collaboration-service";
import { DASHBOARD_CHAT_MAX_LEN } from "@/lib/dashboard-chat-rate-limit";

const PIN_KEY = "cia-dashboard-chat-pinned";

type Props = {
  initialMessages: DashboardChatMessageRow[];
  /** Map author_id -> display name */
  profileNames: Record<string, string>;
};

export function DashboardChat({ initialMessages, profileNames }: Props) {
  const [pinned, setPinned] = useState(false);
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    const res = await fetch("/api/dashboard/chat");
    if (!res.ok) return;
    const data = (await res.json()) as { messages: DashboardChatMessageRow[] };
    setMessages(data.messages);
  }, []);

  useEffect(() => {
    const t = setInterval(() => void refresh(), 8000);
    return () => clearInterval(t);
  }, [refresh]);

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
        "border-zinc-800 bg-zinc-950/80",
        pinned && "xl:sticky xl:top-4 xl:z-10 ring-1 ring-amber-500/20",
      )}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-2">
        <div>
          <CardTitle className="text-base">Workspace chat</CardTitle>
          <CardDescription className="text-xs">
            Lightweight collaboration — not case notes.{" "}
            {activeAuthors.length > 0 ? (
              <span className="text-muted-foreground">
                Active recently:{" "}
                {activeAuthors
                  .map((id) => profileNames[id] ?? id)
                  .slice(0, 6)
                  .join(", ")}
              </span>
            ) : (
              <span className="text-muted-foreground">No recent posters in the last 15 minutes.</span>
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
        {error ? <p className="text-sm text-red-400">{error}</p> : null}
        <div className="max-h-64 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-950/60 p-2 space-y-2 text-sm">
          {messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">No messages yet — say hello.</p>
          ) : (
            messages.map((m) => (
              <div key={m.id} className="border-b border-zinc-800/80 pb-2 last:border-0">
                <p className="text-[10px] text-muted-foreground">
                  {(m.author_id ? profileNames[m.author_id] : null) ??
                    m.author_label ??
                    "Analyst"}{" "}
                  · {new Date(m.created_at).toLocaleString()}
                </p>
                <p className="text-foreground whitespace-pre-wrap">{m.body}</p>
              </div>
            ))
          )}
        </div>
        <form onSubmit={send} className="space-y-2">
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value.slice(0, DASHBOARD_CHAT_MAX_LEN))}
            rows={2}
            placeholder="Quick message to the workspace…"
            className="bg-zinc-950 border-zinc-700 text-sm min-h-[3rem]"
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
