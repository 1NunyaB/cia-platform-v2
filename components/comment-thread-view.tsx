"use client";

import { CommentForm } from "@/components/comment-form";
import type { CommentTreeNode } from "@/lib/comment-threading";
import { AuthorPersonaLine } from "@/components/author-persona-line";
import type { ProfileWithInvestigator } from "@/lib/profiles";

function ThreadNodes({
  caseId,
  evidenceFileId,
  nodes,
  getProfile,
  depth,
}: {
  caseId: string;
  evidenceFileId?: string | null;
  nodes: CommentTreeNode[];
  getProfile: (id: string | null) => ProfileWithInvestigator | undefined;
  depth: number;
}) {
  return (
    <ul className={depth ? "ml-4 mt-2 space-y-3 border-l border-border pl-3" : "space-y-3"}>
      {nodes.map((n) => (
        <li key={n.id} className="rounded-md border border-border bg-panel p-3 text-sm text-foreground">
          <p className="text-[11px] text-muted-foreground mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <AuthorPersonaLine profile={getProfile(n.author_id)} fallbackId={n.author_id} />
            <span className="text-muted-foreground">· {new Date(n.created_at).toLocaleString()}</span>
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
              getProfile={getProfile}
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
  getProfile,
}: {
  caseId: string;
  /** When omitted/null, comments are case-wide (not tied to a file). */
  evidenceFileId?: string | null;
  roots: CommentTreeNode[];
  getProfile: (id: string | null) => ProfileWithInvestigator | undefined;
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
          getProfile={getProfile}
          depth={0}
        />
      )}
    </div>
  );
}
