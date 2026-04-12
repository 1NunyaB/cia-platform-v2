"use client";

import { CaseNoteForm } from "@/components/case-note-form";
import { CommentForm } from "@/components/comment-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authorDisplayName } from "@/lib/display-name";
import type { CommentRow, NoteRow } from "@/types";

type Profiles = Record<string, { display_name: string | null }>;

export function CaseNotesCommentsTabs({
  caseId,
  notes,
  comments,
  profiles,
}: {
  caseId: string;
  notes: NoteRow[];
  comments: CommentRow[];
  profiles: Profiles;
}) {
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
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-border/60 bg-muted/5 p-3 text-sm">
                <p className="mb-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/90">{authorDisplayName(n, profiles)}</span>{" "}
                  <span className="text-muted-foreground/80">
                    {new Date(n.created_at as string).toLocaleString()}
                  </span>
                </p>
                <p className="whitespace-pre-wrap text-foreground/95">{n.body as string}</p>
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
            {comments.map((co) => (
              <li key={co.id} className="rounded-lg border border-border/60 bg-muted/5 p-3 text-sm">
                <p className="mb-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground/90">{authorDisplayName(co, profiles)}</span>
                </p>
                <p className="whitespace-pre-wrap text-foreground/95">{co.body as string}</p>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>
    </Tabs>
  );
}
