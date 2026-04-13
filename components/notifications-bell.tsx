"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NotificationRow = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

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

export function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<NotificationRow[]>([]);
  const [responding, setResponding] = useState<{ proposalId: string; kind: "accept" | "decline" } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications");
      const data = (await res.json()) as { notifications?: NotificationRow[]; error?: string };
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

  const unread = items.filter((n) => !n.read_at).length;

  async function markRead(id: string) {
    await fetch(`/api/notifications/${id}/read`, { method: "PATCH" });
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n)));
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
        className="relative gap-1.5 border-border"
        aria-label="Notifications"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void load();
        }}
      >
        <Bell className="h-4 w-4" aria-hidden />
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
            <div className="border-b border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
              Notifications
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
                    const busy =
                      sp.proposal_id &&
                      responding?.proposalId === sp.proposal_id;
                    return (
                      <li key={n.id} className="p-3 text-sm">
                        <p className="font-medium text-foreground leading-snug">{n.title}</p>
                        {n.body ? <p className="mt-1 text-xs text-muted-foreground line-clamp-3">{n.body}</p> : null}
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
