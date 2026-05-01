"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { StickyNoteRow, StickyReplyRow } from "@/services/collaboration-service";
import { AuthorPersonaLine } from "@/components/author-persona-line";
import type { ProfileWithInvestigator } from "@/lib/profiles";

export function EvidenceStickyNotesPanel({
  caseId,
  evidenceId,
  currentUserId,
  currentUserCanDelete,
  initial,
  profilesById,
}: {
  caseId: string;
  evidenceId: string;
  currentUserId: string | null;
  currentUserCanDelete: boolean;
  initial: { sticky: StickyNoteRow; replies: StickyReplyRow[] }[];
  profilesById: Record<string, ProfileWithInvestigator>;
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
    if (!currentUserId || !currentUserCanDelete) return;
    const code = window.prompt("Enter admin confirmation code");
    if (code == null) return;
    const res = await fetch(`/api/cases/${caseId}/sticky-notes/${id}`, {
      method: "DELETE",
      headers: { "x-admin-confirm-code": code.trim() },
    });
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
          />
          <Button type="submit" size="sm" disabled={loading || !body.trim()}>
            {loading ? "Saving…" : "Add sticky"}
          </Button>
        </form>
      ) : (
        <p className="text-xs leading-relaxed text-foreground">
          Sign in to add sticky notes — the API stores an author id for this case (same Row Level Security rules as other
          case contributions).
        </p>
      )}

      <ul className="space-y-3">
        {initial.map(({ sticky, replies }) => {
          const canDelete = Boolean(currentUserCanDelete);
          return (
            <li key={sticky.id} className="rounded-md border border-border bg-panel p-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] text-foreground flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                  <AuthorPersonaLine profile={sticky.user_id ? profilesById[sticky.user_id] : undefined} fallbackId={sticky.user_id} />
                  <span className="text-foreground/80">{new Date(sticky.created_at).toLocaleString()}</span>
                </p>
                {canDelete ? (
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
                <ul className="ml-3 mt-2 space-y-2 border-l border-border pl-3">
                  {replies.map((r) => (
                    <li key={r.id} className="text-xs text-foreground">
                      <span className="text-foreground/85 inline-flex items-center gap-1">
                        <AuthorPersonaLine profile={r.user_id ? profilesById[r.user_id] : undefined} fallbackId={r.user_id} /> ·{" "}
                      </span>
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
                    className="min-h-[2rem] text-xs"
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
