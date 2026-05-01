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
import { cisCaseForm } from "@/lib/cis-case-page-shell";
import { cn } from "@/lib/utils";

export function CaseNoteForm({
  caseId,
  evidenceFileId,
  placeholder = "Add a note…",
  caseIsPublic = true,
  variant = "default",
}: {
  caseId: string;
  evidenceFileId?: string | null;
  placeholder?: string;
  /** When false, the case-level &ldquo;public note&rdquo; option is hidden (legacy rows). */
  caseIsPublic?: boolean;
  /** Dark CIS case page styling. */
  variant?: "default" | "cisCase";
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

  const dark = variant === "cisCase";

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <div className="space-y-2">
        <Label htmlFor="note-body" className={dark ? cisCaseForm.label : undefined}>
          Note
        </Label>
        <Textarea
          id="note-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className={dark ? cisCaseForm.control : undefined}
        />
      </div>
      {!evidenceFileId ? (
        <div className="space-y-2">
          <Label className={dark ? cisCaseForm.label : undefined}>Visibility</Label>
          <Select
            value={visibility}
            onValueChange={(v) => setVisibility(v as CaseNoteVisibility)}
          >
            <SelectTrigger className={cn("w-full max-w-md", dark && cn(cisCaseForm.control, "h-10 py-0"))}>
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
            <p className={cn("text-[11px]", dark ? "text-slate-500" : "text-muted-foreground")}>
              Case-wide &ldquo;public&rdquo; notes apply to shared investigations listed in the directory.
            </p>
          ) : null}
        </div>
      ) : null}
      <Button
        type="submit"
        disabled={loading || !body.trim()}
        className={dark ? cn("border border-blue-600 bg-[#1e40af] text-white hover:bg-blue-600") : undefined}
      >
        {loading ? "Saving…" : "Save note"}
      </Button>
    </form>
  );
}
