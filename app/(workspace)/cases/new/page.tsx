"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IncidentEntryDialog } from "@/components/incident-entry-dialog";
import type { IncidentEvidenceUploadMeta } from "@/components/incident-entry-dialog";
import type { CaseDirectoryPayload, CaseEvidenceFileEntry, CaseIncidentEntry } from "@/lib/case-directory";
import {
  directoryPayloadFromCaseRow,
  emptyCaseDirectory,
  emptyIncidentEntry,
  mergeIncidentIntoList,
  newIncidentEntryId,
} from "@/lib/case-directory";
import type { CaseRow } from "@/types";
import { Pencil, Plus, Trash2 } from "lucide-react";

export default function NewCasePage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [directory, setDirectory] = useState<CaseDirectoryPayload>(() => emptyCaseDirectory());
  const [caseNotes, setCaseNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitGuard = useRef(false);
  const idempotencyKeyRef = useRef(crypto.randomUUID());
  const [draftCaseId, setDraftCaseId] = useState<string | null>(null);

  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [dialogDraft, setDialogDraft] = useState<CaseIncidentEntry>(() => emptyIncidentEntry());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [incidentPersisting, setIncidentPersisting] = useState(false);

  useEffect(() => {
    idempotencyKeyRef.current = crypto.randomUUID();
    submitGuard.current = false;
  }, []);

  function buildCreateBody() {
    return {
      title,
      description: caseNotes.trim() || null,
      incident_entries: directory.incident_entries,
    };
  }

  function withIncidentApplied(entry: CaseIncidentEntry): CaseIncidentEntry[] {
    return mergeIncidentIntoList(directory.incident_entries, entry, editingIndex);
  }

  function openAddIncident() {
    setEditingIndex(null);
    setDialogDraft(emptyIncidentEntry());
    setIncidentDialogOpen(true);
  }

  function openEditIncident(index: number) {
    const e = directory.incident_entries[index];
    if (!e) return;
    setEditingIndex(index);
    setDialogDraft({ ...e, id: e.id || newIncidentEntryId() });
    setIncidentDialogOpen(true);
  }

  async function saveIncidentFromDialog(entry: CaseIncidentEntry) {
    if (!title.trim()) {
      throw new Error("Enter a case title before saving an incident.");
    }
    const idx = editingIndex;
    const incident_entries = mergeIncidentIntoList(directory.incident_entries, entry, idx);
    setError(null);
    try {
      const caseId = await createCaseIfNeeded(incident_entries);
      const savedCase = await patchCase(caseId, incident_entries);
      setDirectory(directoryPayloadFromCaseRow(savedCase));
      setEditingIndex(null);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save incident";
      setError(msg);
      throw e instanceof Error ? e : new Error(msg);
    }
  }

  async function removeIncident(index: number) {
    const prevEntries = [...directory.incident_entries];
    if (!prevEntries[index]) return;

    const ok = window.confirm(
      "Remove this incident?\n\nIt will be removed from this investigation immediately on the server. Evidence linked to this incident row will be unlinked from the incident (files remain in the case).",
    );
    if (!ok) return;

    const incident_entries = prevEntries.filter((_, i) => i !== index);

    setDirectory({ incident_entries });
    setError(null);
    setIncidentPersisting(true);
    try {
      const caseId = await createCaseIfNeeded(incident_entries);
      const savedCase = await patchCase(caseId, incident_entries);
      setDirectory(directoryPayloadFromCaseRow(savedCase));
      router.refresh();
    } catch (e) {
      setDirectory({ incident_entries: prevEntries });
      setError(e instanceof Error ? e.message : "Failed to remove incident");
    } finally {
      setIncidentPersisting(false);
    }
  }

  function incidentSummary(e: CaseIncidentEntry): string {
    const t =
      e.incident_title?.trim() || (e.description?.trim() ?? "").slice(0, 80) || "Untitled incident";
    const loc = [e.city, e.state].filter(Boolean).join(", ");
    const when = e.date || (e.year != null ? String(e.year) : "");
    return [t, loc, when].filter(Boolean).join(" · ");
  }

  function hasDraftContent(): boolean {
    return (
      title.trim().length > 0 ||
      caseNotes.trim().length > 0 ||
      directory.incident_entries.length > 0
    );
  }

  function handleCancel() {
    if (hasDraftContent()) {
      const ok = window.confirm("Discard changes?");
      if (!ok) return;
    }
    router.push("/cases");
    router.refresh();
  }

  async function createCaseIfNeeded(entries: CaseIncidentEntry[]): Promise<string> {
    if (draftCaseId) return draftCaseId;
    const res = await fetch("/api/cases", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKeyRef.current,
      },
      body: JSON.stringify({
        title,
        description: caseNotes.trim() || null,
        incident_entries: entries,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(JSON.stringify((data as { error?: unknown }).error ?? "Failed"));
    const id = String((data as { id?: string }).id ?? "").trim();
    if (!id) throw new Error("Case was saved but no id was returned.");
    setDraftCaseId(id);
    return id;
  }

  async function patchCase(caseId: string, entries: CaseIncidentEntry[]): Promise<CaseRow> {
    const res = await fetch(`/api/cases/${caseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: caseNotes.trim() || null,
        incident_entries: entries,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(JSON.stringify((data as { error?: unknown }).error ?? "Failed"));
    const savedCase = (data as { case?: CaseRow }).case;
    if (!savedCase) throw new Error("Case save succeeded but server did not return updated case data.");
    return savedCase;
  }

  async function uploadEvidenceForIncident(
    entry: CaseIncidentEntry,
    file: File,
    meta?: IncidentEvidenceUploadMeta,
  ): Promise<CaseIncidentEntry> {
    if (!title.trim()) throw new Error("Enter a case title before attaching files to evidence.");
    const entriesWithIncident = withIncidentApplied(entry);
    const caseId = await createCaseIfNeeded(entriesWithIncident);
    const preSaved = await patchCase(caseId, entriesWithIncident);
    setDirectory(directoryPayloadFromCaseRow(preSaved));
    const fd = new FormData();
    fd.set("file", file);
    fd.set("incident_entry_id", entry.id);
    const uploadRes = await fetch(`/api/cases/${caseId}/evidence`, {
      method: "POST",
      body: fd,
    });
    const uploadData = (await uploadRes.json().catch(() => ({}))) as { id?: string; error?: string; warning?: string };
    if (!uploadRes.ok || !uploadData.id) {
      throw new Error(uploadData.error ?? "Failed to upload evidence for this incident.");
    }
    const evidenceId = uploadData.id;
    let evidence_items: CaseEvidenceFileEntry[];
    if (meta?.replaceRowId) {
      evidence_items = entry.evidence_items.map((r) =>
        r.id === meta.replaceRowId
          ? {
              ...r,
              evidence_id: evidenceId,
              label: r.label.trim() || file.name,
              file_reference: `/cases/${caseId}/evidence/${evidenceId}`,
              notes: r.notes?.trim() ? r.notes : uploadData.warning ?? null,
            }
          : r,
      );
    } else {
      evidence_items = [
        ...entry.evidence_items,
        {
          id: evidenceId,
          evidence_id: evidenceId,
          label: file.name,
          file_reference: `/cases/${caseId}/evidence/${evidenceId}`,
          notes: uploadData.warning ?? null,
        },
      ];
    }
    const next: CaseIncidentEntry = { ...entry, evidence_items };
    const entriesWithEvidence = withIncidentApplied(next);
    const savedCase = await patchCase(caseId, entriesWithEvidence);
    setDirectory(directoryPayloadFromCaseRow(savedCase));
    return next;
  }

  async function doPostCase() {
    if (submitGuard.current) return;
    submitGuard.current = true;
    setError(null);
    setLoading(true);
    try {
      const entries = directory.incident_entries;
      const caseId = draftCaseId ? draftCaseId : await createCaseIfNeeded(entries);
      await patchCase(caseId, entries);
      router.push(`/cases/${caseId}`);
      router.refresh();
    } catch (e) {
      submitGuard.current = false;
      idempotencyKeyRef.current = crypto.randomUUID();
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    await doPostCase();
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/cases" className="text-sm text-muted-foreground hover:underline">
          ← Cases
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">New investigation</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Investigations are shared. Your account records contributions and activity; it does not lock others out.
        </p>
      </div>
      <Card className="border-border shadow-sm">
        <CardHeader>
          <CardTitle className="text-foreground">Case details</CardTitle>
          <CardDescription className="text-foreground/90">
            Add one or more incidents. Saving an incident in the dialog persists it to the investigation (title
            required). Use Continue when you are ready to open the case page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-6">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-foreground">
                Title
              </Label>
              <Input
                id="title"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="border-input bg-form-field text-form-field-foreground"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="case-notes" className="text-foreground">
                Case notes
              </Label>
              <Textarea
                id="case-notes"
                value={caseNotes}
                onChange={(e) => setCaseNotes(e.target.value)}
                rows={8}
                placeholder="General notes about the investigation (not tied to a single incident)."
                className="border-input bg-form-field text-form-field-foreground placeholder:text-muted-foreground min-h-[200px]"
              />
            </div>

            <div className="space-y-3 rounded-md border border-border/80 bg-panel/20 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Incidents</h3>
                  <p className="text-xs text-muted-foreground">
                    Each incident opens in a full editor. Saving the incident persists it; removing one persists
                    immediately after you confirm (once the case exists).
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading || incidentPersisting}
                  onClick={openAddIncident}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add incident
                </Button>
              </div>
              {directory.incident_entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">No incidents yet. Add at least one if the matter involves specific events.</p>
              ) : (
                <ul className="space-y-2">
                  {directory.incident_entries.map((inc, i) => (
                    <li
                      key={inc.id || i}
                      id={inc.id ? `incident-${inc.id}` : undefined}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-panel/40 px-3 py-2"
                    >
                      <p className="text-sm text-foreground min-w-0 flex-1">{incidentSummary(inc)}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          aria-label="Edit incident"
                          disabled={loading || incidentPersisting}
                          onClick={() => openEditIncident(i)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          aria-label="Remove incident"
                          disabled={loading || incidentPersisting}
                          onClick={() => void removeIncident(i)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="submit"
                disabled={loading}
                className="bg-primary text-primary-foreground"
              >
                {loading ? "Saving…" : "Continue"}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={loading}
                onClick={handleCancel}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <IncidentEntryDialog
        open={incidentDialogOpen}
        onOpenChange={setIncidentDialogOpen}
        initialEntry={dialogDraft}
        onSave={saveIncidentFromDialog}
        onUploadEvidence={uploadEvidenceForIncident}
        heading={editingIndex != null ? "Edit incident" : "Add incident"}
      />

    </div>
  );
}
