"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { StickyNoteRow, StickyReplyRow } from "@/services/collaboration-service";

export function EvidenceStickyNotesPanel({
  caseId,
  evidenceId,
  currentUserId,
  initial,
  authorLabel,
}: {
  caseId: string;
  evidenceId: string;
  currentUserId: string | null;
  initial: { sticky: StickyNoteRow; replies: StickyReplyRow[] }[];
  authorLabel: (id: string | null) => string;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});

  async function addSticky(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !currentUserId) return;
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/cases/${caseId}/evidence/${evidenceId}/sticky-notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError((data as { error?: string }).error ?? "Failed");
      return;
    }
    setBody("");
    router.refresh();
  }

  async function deleteSticky(id: string) {
    if (!currentUserId) return;
    const res = await fetch(`/api/cases/${caseId}/sticky-notes/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? "Delete failed");
      return;
    }
    router.refresh();
  }

  async function addReply(stickyId: string) {
    const text = (replyDrafts[stickyId] ?? "").trim();
    if (!text || !currentUserId) return;
    const res = await fetch(`/api/cases/${caseId}/sticky-notes/${stickyId}/replies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError((data as { error?: string }).error ?? "Reply failed");
      return;
    }
    setReplyDrafts((d) => ({ ...d, [stickyId]: "" }));
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {currentUserId ? (
        <form onSubmit={addSticky} className="space-y-2">
          <Label htmlFor="sticky-new">New sticky note</Label>
          <Textarea
            id="sticky-new"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Quick observation on this file…"
            className="bg-zinc-950 border-zinc-700"
          />
          <Button type="submit" size="sm" disabled={loading || !body.trim()}>
            {loading ? "Saving…" : "Add sticky"}
          </Button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">Sign in to add sticky notes.</p>
      )}

      <ul className="space-y-3">
        {initial.map(({ sticky, replies }) => {
          const mine = currentUserId && sticky.author_id === currentUserId;
          return (
            <li key={sticky.id} className="rounded-md border border-amber-500/25 bg-amber-950/10 p-3">
              <div className="flex justify-between gap-2 items-start">
                <p className="text-[11px] text-muted-foreground">
                  {authorLabel(sticky.author_id)}{" "}
                  <span className="text-muted-foreground">
                    {new Date(sticky.created_at).toLocaleString()}
                  </span>
                </p>
                {mine ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs text-muted-foreground h-7"
                    onClick={() => void deleteSticky(sticky.id)}
                  >
                    Delete
                  </Button>
                ) : null}
              </div>
              <p className="text-sm text-foreground whitespace-pre-wrap mt-1">{sticky.body}</p>
              {replies.length > 0 ? (
                <ul className="mt-2 ml-3 border-l border-zinc-700 pl-3 space-y-2">
                  {replies.map((r) => (
                    <li key={r.id} className="text-xs text-foreground">
                      <span className="text-muted-foreground">{authorLabel(r.author_id)} · </span>
                      {new Date(r.created_at).toLocaleString()}
                      <p className="text-sm mt-0.5 whitespace-pre-wrap">{r.body}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
              {currentUserId ? (
                <div className="mt-2 flex gap-2">
                  <Textarea
                    value={replyDrafts[sticky.id] ?? ""}
                    onChange={(e) =>
                      setReplyDrafts((d) => ({ ...d, [sticky.id]: e.target.value }))
                    }
                    rows={1}
                    placeholder="Reply…"
                    className="bg-zinc-950 border-zinc-700 text-xs min-h-[2rem]"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void addReply(sticky.id)}
                  >
                    Reply
                  </Button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
