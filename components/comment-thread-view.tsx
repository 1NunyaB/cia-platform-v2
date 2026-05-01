"use client";

import { CommentForm } from "@/components/comment-form";
import type { CommentTreeNode } from "@/lib/comment-threading";
import { AuthorPersonaLine } from "@/components/author-persona-line";
import type { ProfileWithInvestigator } from "@/lib/profiles";
import { cisCasePage } from "@/lib/cis-case-page-shell";
import { cn } from "@/lib/utils";

function ThreadNodes({
  caseId,
  evidenceFileId,
  nodes,
  profilesById,
  depth,
  variant,
}: {
  caseId: string;
  evidenceFileId?: string | null;
  nodes: CommentTreeNode[];
  profilesById: Record<string, ProfileWithInvestigator>;
  depth: number;
  variant: "default" | "cisCase";
}) {
  const dark = variant === "cisCase";
  return (
    <ul
      className={
        depth
          ? cn("ml-4 mt-2 space-y-3 border-l pl-3", dark ? "border-[#1e2d42]" : "border-border")
          : "space-y-3"
      }
    >
      {nodes.map((n) => (
        <li
          key={n.id}
          className={cn(
            "rounded-md border p-3 text-sm",
            dark ? cisCasePage.noteListItem : "border-border bg-panel text-foreground",
          )}
        >
          <p
            className={cn(
              "mb-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px]",
              dark ? "text-slate-500" : "text-muted-foreground",
            )}
          >
            <AuthorPersonaLine profile={n.user_id ? profilesById[n.user_id] : undefined} fallbackId={n.user_id} />
            <span className={dark ? "text-slate-500" : "text-muted-foreground"}>
              · {new Date(n.created_at).toLocaleString()}
            </span>
          </p>
          <p className={cn("whitespace-pre-wrap", dark ? "text-slate-200" : "text-foreground")}>{n.body}</p>
          <div className="mt-2">
            <CommentForm
              caseId={caseId}
              evidenceFileId={evidenceFileId}
              parentCommentId={n.id}
              compact
              variant={variant}
            />
          </div>
          {n.children.length > 0 ? (
            <ThreadNodes
              caseId={caseId}
              evidenceFileId={evidenceFileId}
              nodes={n.children}
              profilesById={profilesById}
              depth={depth + 1}
              variant={variant}
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
  profilesById,
  variant = "default",
}: {
  caseId: string;
  /** When omitted/null, comments are case-wide (not tied to a file). */
  evidenceFileId?: string | null;
  roots: CommentTreeNode[];
  profilesById: Record<string, ProfileWithInvestigator>;
  variant?: "default" | "cisCase";
}) {
  const dark = variant === "cisCase";
  return (
    <div className="space-y-4">
      <CommentForm caseId={caseId} evidenceFileId={evidenceFileId ?? null} variant={variant} />
      {roots.length === 0 ? (
        <p className={cn("text-sm", dark ? "text-slate-500" : "text-muted-foreground")}>No comments yet.</p>
      ) : (
        <ThreadNodes
          caseId={caseId}
          evidenceFileId={evidenceFileId}
          nodes={roots}
          profilesById={profilesById}
          depth={0}
          variant={variant}
        />
      )}
    </div>
  );
}
