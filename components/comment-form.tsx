"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function CommentForm({
  caseId,
  evidenceFileId,
  noteId,
  parentCommentId,
  compact,
}: {
  caseId: string;
  evidenceFileId?: string | null;
  noteId?: string | null;
  parentCommentId?: string | null;
  /** Smaller UI for inline thread replies */
  compact?: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/cases/${caseId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body,
        evidenceFileId: evidenceFileId ?? null,
        noteId: noteId ?? null,
        parentCommentId: parentCommentId ?? null,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError((data as { error?: string }).error ?? "Failed to post comment");
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className={compact ? "flex flex-wrap gap-2 items-end" : "space-y-2"}>
      {error ? (
        <Alert variant="destructive" className={compact ? "w-full" : ""}>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className={compact ? "flex-1 min-w-[120px]" : "space-y-2"}>
        {!compact ? <Label htmlFor="comment-body">Comment</Label> : null}
        <Textarea
          id={compact ? `comment-${parentCommentId ?? "root"}` : "comment-body"}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={compact ? 1 : 2}
          placeholder={compact ? "Reply…" : undefined}
          className={compact ? "min-h-[2rem] text-xs" : undefined}
        />
      </div>
      <Button type="submit" size="sm" disabled={loading || !body.trim()}>
        {loading ? "Posting…" : compact ? "Reply" : "Post comment"}
      </Button>
    </form>
  );
}
