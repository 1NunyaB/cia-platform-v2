"use client";

import { CommentForm } from "@/components/comment-form";
import type { CommentTreeNode } from "@/lib/comment-threading";

function ThreadNodes({
  caseId,
  evidenceFileId,
  nodes,
  profileName,
  depth,
}: {
  caseId: string;
  evidenceFileId?: string | null;
  nodes: CommentTreeNode[];
  profileName: (id: string | null) => string;
  depth: number;
}) {
  return (
    <ul className={depth ? "ml-4 border-l border-zinc-700 pl-3 space-y-3 mt-2" : "space-y-3"}>
      {nodes.map((n) => (
        <li key={n.id} className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3 text-sm">
          <p className="text-[11px] text-muted-foreground mb-1">
            {profileName(n.author_id)} · {new Date(n.created_at).toLocaleString()}
          </p>
          <p className="text-foreground whitespace-pre-wrap">{n.body}</p>
          <div className="mt-2">
            <CommentForm
              caseId={caseId}
              evidenceFileId={evidenceFileId}
              parentCommentId={n.id}
              compact
            />
          </div>
          {n.children.length > 0 ? (
            <ThreadNodes
              caseId={caseId}
              evidenceFileId={evidenceFileId}
              nodes={n.children}
              profileName={profileName}
              depth={depth + 1}
            />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Threaded comments for a case (no evidence file) or for one evidence item. */
export function CommentThreadView({
  caseId,
  evidenceFileId,
  roots,
  profileName,
}: {
  caseId: string;
  /** When omitted/null, comments are case-wide (not tied to a file). */
  evidenceFileId?: string | null;
  roots: CommentTreeNode[];
  profileName: (id: string | null) => string;
}) {
  return (
    <div className="space-y-4">
      <CommentForm caseId={caseId} evidenceFileId={evidenceFileId ?? null} />
      {roots.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ThreadNodes
          caseId={caseId}
          evidenceFileId={evidenceFileId}
          nodes={roots}
          profileName={profileName}
          depth={0}
        />
      )}
    </div>
  );
}
