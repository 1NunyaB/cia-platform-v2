"use client";

import { CaseNoteForm } from "@/components/case-note-form";
import { CommentForm } from "@/components/comment-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Profiles = Record<string, { display_name: string | null }>;

type AuthorLike = {
  user_id?: string | null;
  user_label?: string | null;
};

type CaseNotesCommentsTabsProps = {
  caseId: string;
  notes: any[];
  comments: any[];
  profiles: Profiles;
};

function getAuthorName(row: AuthorLike, profiles: Profiles) {
  const userId = row.user_id ?? "";
  return profiles?.[userId]?.display_name ?? row.user_label ?? "Unknown";
}

export function CaseNotesCommentsTabs({
  caseId,
  notes,
  comments,
  profiles,
}: CaseNotesCommentsTabsProps) {
  return (
    <Tabs defaultValue="notes" className="w-full">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="notes">Notes</TabsTrigger>
        <TabsTrigger value="discussion">Discussion</TabsTrigger>
      </TabsList>

      <TabsContent value="notes" className="space-y-6 pt-4">
        <CaseNoteForm caseId={caseId} />

        {notes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No notes yet — capture hypotheses, sources, and leads here.
          </p>
        ) : (
          <ul className="space-y-3">
            {notes.map((note) => (
              <li
                key={note.id}
                className="rounded-lg border border-border/60 bg-muted/5 p-3 text-sm"
              >
                <p className="mb-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/90">
                    {getAuthorName(
                      {
                        user_id: note.user_id ?? null,
                        user_label: note.user_label ?? null,
                      },
                      profiles
                    )}
                  </span>{" "}
                  <span className="text-muted-foreground/80">
                    {new Date(note.created_at as string).toLocaleString()}
                  </span>
                </p>

                <p className="whitespace-pre-wrap text-foreground/95">
                  {note.body as string}
                </p>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="discussion" className="space-y-6 pt-4">
        <CommentForm caseId={caseId} />

        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((comment) => (
              <li
                key={comment.id}
                className="rounded-lg border border-border/60 bg-muted/5 p-3 text-sm"
              >
                <p className="mb-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/90">
                    {getAuthorName(
                      {
                        user_id: comment.user_id ?? null,
                        user_label: comment.user_label ?? null,
                      },
                      profiles
                    )}
                  </span>{" "}
                  <span className="text-muted-foreground/80">
                    {new Date(comment.created_at as string).toLocaleString()}
                  </span>
                </p>

                <p className="whitespace-pre-wrap text-foreground/95">
                  {comment.body as string}
                </p>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
