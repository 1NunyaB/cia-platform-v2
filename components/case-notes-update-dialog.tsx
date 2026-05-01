"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
/** Minimal row shape for the notes editor (matches `CasesPageRow`). */
export type CaseNotesListRow = {
  id: string;
  title: string;
  description: string | null;
};

type Props = {
  rows: CaseNotesListRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CaseNotesUpdateDialog({ rows, open, onOpenChange }: Props) {
  const router = useRouter();
  const [caseId, setCaseId] = useState("");
  const [draft, setDraft] = useState("");
  const [baseline, setBaseline] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || rows.length === 0) return;
    setCaseId((prev) => {
      const ok = prev && rows.some((r) => r.id === prev);
      return ok ? prev : rows[0]!.id;
    });
  }, [open, rows]);

  useEffect(() => {
    if (!open || !caseId) return;
    const row = rows.find((r) => r.id === caseId);
    if (!row) return;
    const notes = row.description ?? "";
    setDraft(notes);
    setBaseline(notes);
    setError(null);
  }, [open, caseId, rows]);

  function handleCancel() {
    setDraft(baseline);
    setError(null);
    onOpenChange(false);
  }

  async function handleSave() {
    if (!caseId) return;
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/cases/${caseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: draft.trim() || null }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      const err = (data as { error?: unknown }).error;
      setError(typeof err === "string" ? err : JSON.stringify(err ?? "Failed to save"));
      return;
    }
    setBaseline(draft.trim());
    router.refresh();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,800px)] w-[min(96vw,42rem)] max-w-[min(96vw,42rem)] gap-0 overflow-hidden p-0 flex flex-col">
        <DialogHeader className="shrink-0 border-b border-border px-6 py-4 text-left">
          <DialogTitle className="text-foreground">Update case notes</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Case notes are stored on the investigation record. Choose a case, edit the text, then save.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cases available.</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label className="text-foreground">Case</Label>
                <Select value={caseId} onValueChange={setCaseId}>
                  <SelectTrigger className="border-input bg-form-field text-form-field-foreground w-full">
                    <SelectValue placeholder="Select case" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[min(50vh,280px)]">
                    {rows.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="case-notes-modal" className="text-foreground">
                  Case notes
                </Label>
                <Textarea
                  id="case-notes-modal"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  rows={16}
                  placeholder="General notes for this investigation…"
                  className="border-input bg-form-field text-form-field-foreground placeholder:text-muted-foreground min-h-[320px] resize-y"
                />
              </div>
              {error ? <p className="text-sm text-destructive">{error}</p> : null}
            </>
          )}
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            className="bg-primary text-primary-foreground"
            onClick={() => void handleSave()}
            disabled={saving || rows.length === 0}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
