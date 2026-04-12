"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CaseNoteVisibility } from "@/types/collaboration";
import { CASE_NOTE_VISIBILITY_LABELS } from "@/types/collaboration";

export function CaseNoteForm({
  caseId,
  evidenceFileId,
  placeholder = "Add a note…",
  caseIsPublic = false,
}: {
  caseId: string;
  evidenceFileId?: string | null;
  placeholder?: string;
  /** When false, "Public" visibility option is hidden/disabled. */
  caseIsPublic?: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [visibility, setVisibility] = useState<CaseNoteVisibility>("shared_case");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/cases/${caseId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        body,
        evidenceFileId: evidenceFileId ?? null,
        visibility,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError((data as { error?: string }).error ?? "Failed to save note");
      return;
    }
    setBody("");
    setVisibility("shared_case");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="note-body">Note</Label>
        <Textarea
          id="note-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder}
          rows={3}
        />
      </div>
      {!evidenceFileId ? (
        <div className="space-y-2">
          <Label>Visibility</Label>
          <Select
            value={visibility}
            onValueChange={(v) => setVisibility(v as CaseNoteVisibility)}
          >
            <SelectTrigger className="w-full max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="private">{CASE_NOTE_VISIBILITY_LABELS.private}</SelectItem>
              <SelectItem value="shared_case">{CASE_NOTE_VISIBILITY_LABELS.shared_case}</SelectItem>
              {caseIsPublic ? (
                <SelectItem value="public_case">{CASE_NOTE_VISIBILITY_LABELS.public_case}</SelectItem>
              ) : null}
            </SelectContent>
          </Select>
          {!caseIsPublic ? (
            <p className="text-[11px] text-muted-foreground">
              Public visibility is available only when the case is set to public.
            </p>
          ) : null}
        </div>
      ) : null}
      <Button type="submit" disabled={loading || !body.trim()}>
        {loading ? "Saving…" : "Save note"}
      </Button>
    </form>
  );
}
