"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotificationsRealtime } from "@/hooks/use-notifications-realtime";
import { HIGH_PRIORITY_NOTIFICATION_KINDS } from "@/lib/notification-kinds";
import { cn } from "@/lib/utils";
import type { UserNotificationRow } from "@/services/notification-service";

type SharePayload = {
  proposal_id?: string;
  target_case_id?: string;
  source_case_id?: string;
  evidence_file_id?: string;
  source_case_title?: string;
  evidence_filename?: string;
  summary_what?: string;
  summary_why?: string;
};

function asSharePayload(p: Record<string, unknown>): SharePayload {
  return {
    proposal_id: typeof p.proposal_id === "string" ? p.proposal_id : undefined,
    target_case_id: typeof p.target_case_id === "string" ? p.target_case_id : undefined,
    source_case_id: typeof p.source_case_id === "string" ? p.source_case_id : undefined,
    evidence_file_id: typeof p.evidence_file_id === "string" ? p.evidence_file_id : undefined,
    source_case_title: typeof p.source_case_title === "string" ? p.source_case_title : undefined,
    evidence_filename: typeof p.evidence_filename === "string" ? p.evidence_filename : undefined,
    summary_what: typeof p.summary_what === "string" ? p.summary_what : undefined,
    summary_why: typeof p.summary_why === "string" ? p.summary_why : undefined,
  };
}

function notificationHref(n: UserNotificationRow): string | null {
  if (n.link_url?.trim()) return n.link_url;
  if (n.case_id) return `/cases/${n.case_id}`;
  const p = n.payload ?? {};
  if (typeof p.case_id === "string") return `/cases/${p.case_id}`;
  if (typeof p.target_case_id === "string") return `/cases/${p.target_case_id}`;
  return null;
}

export function NotificationsBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<UserNotificationRow[]>([]);
  const [responding, setResponding] = useState<{ proposalId: string; kind: "accept" | "decline" } | null>(null);
  const [lastAcknowledgedPriorityId, setLastAcknowledgedPriorityId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const data = (await res.json()) as { notifications?: UserNotificationRow[]; error?: string };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Failed to load");
      setItems(Array.isArray(data.notifications) ? data.notifications : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRealtimeInsert = useCallback((row: UserNotificationRow) => {
    setItems((prev) => {
      if (prev.some((x) => x.id === row.id)) return prev;
      return [row, ...prev];
    });
  }, []);

  useNotificationsRealtime(userId, onRealtimeInsert);

  const unread = items.filter((n) => !n.read_at).length;
  const newestHighPriorityUnread = items.find(
    (n) => !n.read_at && HIGH_PRIORITY_NOTIFICATION_KINDS.has(n.kind),
  );
  const shouldFlashPriorityAlert =
    !!newestHighPriorityUnread && newestHighPriorityUnread.id !== lastAcknowledgedPriorityId;

  useEffect(() => {
    if (open && newestHighPriorityUnread?.id) {
      setLastAcknowledgedPriorityId(newestHighPriorityUnread.id);
    }
  }, [open, newestHighPriorityUnread?.id]);

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
  }

  async function markAllRead() {
    const res = await fetch("/api/notifications/read-all", { method: "POST" });
    if (res.ok) {
      const now = new Date().toISOString();
      setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    }
  }

  async function respond(proposalId: string, accept: boolean, notificationId: string) {
    setResponding({ proposalId, kind: accept ? "accept" : "decline" });
    try {
      const res = await fetch(`/api/evidence-share-proposals/${proposalId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accept }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        throw new Error(typeof j.error === "string" ? j.error : "Request failed");
      }
      await markRead(notificationId);
      await load();
    } catch (e) {
      console.error(e);
    } finally {
      setResponding(null);
    }
  }

  return (
    <div className="relative">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className={cn(
          "relative gap-1.5 border-border",
          shouldFlashPriorityAlert ? "ring-1 ring-red-500/70 shadow-[0_0_0_1px_rgba(239,68,68,0.25)]" : "",
        )}
        aria-label="Notifications"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void load();
        }}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {shouldFlashPriorityAlert ? (
          <span
            aria-hidden
            className="absolute -left-2 -top-2 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold text-white cis-notification-alert-flash"
            title="Important notification"
          >
            🚨
          </span>
        ) : null}
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-sky-700 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </Button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-label="Close notifications"
            onClick={() => setOpen(false)}
          />
          <div
            className={cn(
              "absolute right-0 top-full z-50 mt-2 w-[min(100vw-2rem,22rem)] rounded-lg border border-border bg-card shadow-lg",
            )}
          >
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <span className="text-xs font-semibold text-muted-foreground">Notifications</span>
              {unread > 0 ? (
                <button
                  type="button"
                  className="text-[11px] font-medium text-blue-800 underline underline-offset-2 hover:text-blue-900"
                  onClick={() => void markAllRead()}
                >
                  Mark all read
                </button>
              ) : null}
            </div>
            <div className="max-h-[min(70vh,24rem)] overflow-y-auto">
              {loading && items.length === 0 ? (
                <div className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Loading…
                </div>
              ) : items.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">No notifications yet.</p>
              ) : (
                <ul className="divide-y divide-border">
                  {items.map((n) => {
                    const sp = n.kind === "evidence_share_proposal" ? asSharePayload(n.payload) : {};
                    const href = notificationHref(n);
                    const busy = sp.proposal_id && responding?.proposalId === sp.proposal_id;

                    return (
                      <li key={n.id} className="p-3 text-sm">
                        <p className="font-medium leading-snug text-foreground">{n.title}</p>
                        {n.body ? <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{n.body}</p> : null}
                        {n.kind === "evidence_share_proposal" && sp.proposal_id && sp.target_case_id ? (
                          <div className="mt-2 space-y-1.5 text-xs text-muted-foreground">
                            {sp.source_case_title ? (
                              <p>
                                From investigation:{" "}
                                <Link
                                  href={`/cases/${sp.source_case_id ?? ""}`}
                                  className="font-medium text-blue-800 underline-offset-2 hover:underline"
                                  onClick={() => void markRead(n.id)}
                                >
                                  {sp.source_case_title}
                                </Link>
                              </p>
                            ) : null}
                            {sp.evidence_filename ? (
                              <p>
                                File: <span className="text-foreground">{sp.evidence_filename}</span>
                              </p>
                            ) : null}
                            {sp.summary_why ? (
                              <p className="text-[11px] leading-relaxed">
                                <span className="font-medium text-foreground/90">Why it may matter: </span>
                                {sp.summary_why}
                              </p>
                            ) : null}
                            <div className="flex flex-wrap gap-2 pt-1">
                              <Button
                                type="button"
                                size="sm"
                                className="h-8 gap-1"
                                disabled={!!busy || !!n.read_at}
                                onClick={() =>
                                  sp.proposal_id ? void respond(sp.proposal_id, true, n.id) : undefined
                                }
                              >
                                {busy && responding?.kind === "accept" ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                ) : (
                                  <Check className="h-3.5 w-3.5" aria-hidden />
                                )}
                                Accept link
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="secondary"
                                className="h-8 gap-1"
                                disabled={!!busy || !!n.read_at}
                                onClick={() =>
                                  sp.proposal_id ? void respond(sp.proposal_id, false, n.id) : undefined
                                }
                              >
                                {busy && responding?.kind === "decline" ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                                ) : (
                                  <X className="h-3.5 w-3.5" aria-hidden />
                                )}
                                Decline
                              </Button>
                              <Button variant="ghost" size="sm" className="h-8" asChild>
                                <Link
                                  href={`/cases/${sp.target_case_id}#case-evidence`}
                                  onClick={() => void markRead(n.id)}
                                >
                                  Open case
                                </Link>
                              </Button>
                            </div>
                          </div>
                        ) : n.kind === "evidence_share_proposal" ? (
                          <button
                            type="button"
                            className="mt-2 text-xs text-blue-800 underline"
                            onClick={() => void markRead(n.id)}
                          >
                            Mark read
                          </button>
                        ) : href ? (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Button variant="ghost" size="sm" className="h-8" asChild>
                              <Link href={href} onClick={() => void markRead(n.id)}>
                                Open
                              </Link>
                            </Button>
                            <button
                              type="button"
                              className="text-xs text-blue-800 underline"
                              onClick={() => void markRead(n.id)}
                            >
                              Mark read
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="mt-2 text-xs text-blue-800 underline"
                            onClick={() => void markRead(n.id)}
                          >
                            Mark read
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
