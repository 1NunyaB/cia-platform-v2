"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CaseRow } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { IncidentEntryDialog } from "@/components/incident-entry-dialog";
import type { IncidentEvidenceUploadMeta } from "@/components/incident-entry-dialog";
import type { CaseDirectoryPayload, CaseEvidenceFileEntry, CaseIncidentEntry } from "@/lib/case-directory";
import {
  directoryPayloadFromCaseRow,
  emptyIncidentEntry,
  mergeIncidentIntoList,
  newIncidentEntryId,
} from "@/lib/case-directory";
import { cisCaseForm, cisCasePage } from "@/lib/cis-case-page-shell";
import { cn } from "@/lib/utils";
import { Pencil, Plus, Trash2 } from "lucide-react";

const inputClass = cn(cisCaseForm.control);

export type EditCaseDetailsInitial = {
  title: string;
  /** Case-level notes (stored in `cases.description`). */
  description: string;
} & CaseDirectoryPayload;

export function EditCaseDetailsCard({
  caseId,
  canEdit,
  initial,
}: {
  caseId: string;
  canEdit: boolean;
  initial: EditCaseDetailsInitial;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(initial.title);
  const [caseNotes, setCaseNotes] = useState(initial.description);
  const [directory, setDirectory] = useState<CaseDirectoryPayload>(() => ({
    incident_entries: initial.incident_entries,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [incidentDialogOpen, setIncidentDialogOpen] = useState(false);
  const [dialogDraft, setDialogDraft] = useState<CaseIncidentEntry>(() => emptyIncidentEntry());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

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
    const idx = editingIndex;
    const incident_entries = mergeIncidentIntoList(directory.incident_entries, entry, idx);
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: caseNotes.trim() || null,
          incident_entries,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = (data as { error?: unknown }).error;
        throw new Error(typeof err === "string" ? err : JSON.stringify(err ?? "Failed to save incident"));
      }
      const savedCase = (data as { case?: CaseRow }).case;
      if (savedCase) {
        const dir = directoryPayloadFromCaseRow(savedCase);
        setDirectory(dir);
        if (typeof savedCase.title === "string") setTitle(savedCase.title);
        setCaseNotes(savedCase.description ?? "");
      } else {
        setDirectory({ incident_entries });
      }
      setSavedAt(new Date().toISOString());
      setEditingIndex(null);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to save incident";
      setError(msg);
      throw e instanceof Error ? e : new Error(msg);
    } finally {
      setSaving(false);
    }
  }

  async function removeIncident(index: number) {
    const inc = directory.incident_entries[index];
    if (!inc) return;

    const ok = window.confirm(
      "Remove this incident?\n\nIt will be removed from this investigation immediately on the server. Evidence linked to this incident row will be unlinked from the incident (files remain in the case).",
    );
    if (!ok) return;

    const prevEntries = [...directory.incident_entries];
    const incident_entries = prevEntries.filter((_, i) => i !== index);

    setDirectory({ incident_entries });
    setError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/cases/${caseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: caseNotes.trim() || null,
          incident_entries,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = (data as { error?: unknown }).error;
        throw new Error(typeof err === "string" ? err : JSON.stringify(err ?? "Failed to remove incident"));
      }
      const savedCase = (data as { case?: CaseRow }).case;
      if (savedCase) {
        const dir = directoryPayloadFromCaseRow(savedCase);
        setDirectory(dir);
        if (typeof savedCase.title === "string") setTitle(savedCase.title);
        setCaseNotes(savedCase.description ?? "");
      } else {
        setDirectory({ incident_entries });
      }
      setSavedAt(new Date().toISOString());
      router.refresh();
    } catch (e) {
      setDirectory({ incident_entries: prevEntries });
      setError(e instanceof Error ? e.message : "Failed to remove incident");
    } finally {
      setSaving(false);
    }
  }

  function withIncidentApplied(entry: CaseIncidentEntry): CaseIncidentEntry[] {
    return mergeIncidentIntoList(directory.incident_entries, entry, editingIndex);
  }

  async function uploadEvidenceForIncident(
    entry: CaseIncidentEntry,
    file: File,
    meta?: IncidentEvidenceUploadMeta,
  ): Promise<CaseIncidentEntry> {
    const entriesWithIncident = withIncidentApplied(entry);
    const pre = await fetch(`/api/cases/${caseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: caseNotes.trim() || null,
        incident_entries: entriesWithIncident,
      }),
    });
    const preData = await pre.json().catch(() => ({}));
    if (!pre.ok) {
      const err = (preData as { error?: unknown }).error;
      throw new Error(typeof err === "string" ? err : JSON.stringify(err ?? "Failed to save incident before upload"));
    }
    const preSavedCase = (preData as { case?: CaseRow }).case;
    if (preSavedCase) {
      setDirectory(directoryPayloadFromCaseRow(preSavedCase));
      if (typeof preSavedCase.title === "string") setTitle(preSavedCase.title);
      setCaseNotes(preSavedCase.description ?? "");
    } else {
      setDirectory({ incident_entries: entriesWithIncident });
    }

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
    const nextEntries = withIncidentApplied(next);
    const res = await fetch(`/api/cases/${caseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: caseNotes.trim() || null,
        incident_entries: nextEntries,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (data as { error?: unknown }).error;
      throw new Error(typeof err === "string" ? err : JSON.stringify(err ?? "Failed to save case after upload"));
    }
    const savedCase = (data as { case?: CaseRow }).case;
    if (savedCase) {
      setDirectory(directoryPayloadFromCaseRow(savedCase));
      if (typeof savedCase.title === "string") setTitle(savedCase.title);
      setCaseNotes(savedCase.description ?? "");
    } else {
      setDirectory({ incident_entries: nextEntries });
    }
    return next;
  }

  function incidentSummary(e: CaseIncidentEntry): string {
    const t = e.incident_title?.trim() || (e.description?.trim() ?? "").slice(0, 80) || "Untitled incident";
    const loc = [e.city, e.state].filter(Boolean).join(", ");
    const when = e.date || (e.year != null ? String(e.year) : "");
    return [t, loc, when].filter(Boolean).join(" · ");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canEdit || saving) return;
    setError(null);

    setSaving(true);
    const res = await fetch(`/api/cases/${caseId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        description: caseNotes.trim() || null,
        incident_entries: directory.incident_entries,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      const err = (data as { error?: unknown }).error;
      setError(typeof err === "string" ? err : JSON.stringify(err ?? "Failed to save"));
      return;
    }
    const savedCase = (data as { case?: CaseRow }).case;
    if (savedCase) {
      const dir = directoryPayloadFromCaseRow(savedCase);
      setDirectory(dir);
      if (typeof savedCase.title === "string") setTitle(savedCase.title);
      setCaseNotes(savedCase.description ?? "");
    }
    setSavedAt(new Date().toISOString());
    router.refresh();
  }

  if (!canEdit) {
    return null;
  }

  return (
    <Card className={cn(cisCasePage.panel)} id="edit-case-details">
      <CardHeader className={cisCasePage.panelHeaderBorder}>
        <CardTitle className={cisCasePage.cardTitle}>Case details</CardTitle>
        <CardDescription className={cisCasePage.cardDescription}>
          Incidents save automatically when you finish Add or Edit incident. Use the button below to save the case
          title and case notes only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          {error ? (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          {savedAt ? (
            <p className="text-sm text-slate-500" role="status">
              Saved.
            </p>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor="edit-case-title" className={cisCaseForm.label}>
              Title
            </Label>
            <Input
              id="edit-case-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-case-notes" className={cisCaseForm.label}>
              Case notes
            </Label>
            <Textarea
              id="edit-case-notes"
              value={caseNotes}
              onChange={(e) => setCaseNotes(e.target.value)}
              rows={8}
              placeholder="General notes about the investigation."
              className={`${inputClass} min-h-[200px]`}
            />
          </div>

          <div className="space-y-3 rounded-xl border border-[#1e2d42] bg-[#0f1623]/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-white">Incidents</h3>
                <p className="text-xs text-slate-500">
                  Add/edit saves from the popup; removing an incident saves immediately after you confirm.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cisCasePage.outlineBtn}
                disabled={saving}
                onClick={openAddIncident}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add incident
              </Button>
            </div>
            {directory.incident_entries.length === 0 ? (
              <p className="text-sm text-slate-500">No incidents listed.</p>
            ) : (
              <ul className="space-y-2">
                {directory.incident_entries.map((inc, i) => (
                  <li
                    key={inc.id || i}
                    id={inc.id ? `incident-${inc.id}` : undefined}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#1e2d42] bg-[#111827]/60 px-3 py-2"
                  >
                    <p className="min-w-0 flex-1 text-sm text-slate-200">{incidentSummary(inc)}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:bg-[#1a2335] hover:text-slate-100"
                        aria-label="Edit incident"
                        disabled={saving}
                        onClick={() => openEditIncident(i)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-400 hover:bg-red-950/30 hover:text-red-300"
                        aria-label="Remove incident"
                        disabled={saving}
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

          <Button
            type="submit"
            disabled={saving}
            className="border border-blue-600 bg-[#1e40af] text-white shadow-none hover:bg-blue-600"
          >
            {saving ? "Saving…" : "Save title & notes"}
          </Button>
        </form>
      </CardContent>

      <IncidentEntryDialog
        open={incidentDialogOpen}
        onOpenChange={setIncidentDialogOpen}
        initialEntry={dialogDraft}
        onSave={saveIncidentFromDialog}
        onUploadEvidence={uploadEvidenceForIncident}
        heading={editingIndex != null ? "Edit incident" : "Add incident"}
      />
    </Card>
  );
}
