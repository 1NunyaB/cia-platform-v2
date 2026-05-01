"use client";

import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CasePeopleRows } from "@/components/case-people-rows";
import { CaseLegalMilestoneRows } from "@/components/case-legal-milestone-rows";
import { CaseEvidenceFileRows } from "@/components/case-evidence-file-rows";
import type { CaseIncidentEntry } from "@/lib/case-directory";
import { stripEmptyEvidenceItems } from "@/lib/case-directory";
import { US_STATE_OPTIONS } from "@/lib/us-states";
import { CityCombobox } from "@/components/city-combobox";
import { Loader2 } from "lucide-react";

const inputClass = "border-input bg-form-field text-form-field-foreground";

export type IncidentEvidenceUploadMeta = {
  /** Replace this evidence row after upload (stable client row id). */
  replaceRowId?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialEntry: CaseIncidentEntry;
  /** Persist the incident; may be async. Throw on failure to keep the dialog open and show the error. */
  onSave: (entry: CaseIncidentEntry) => void | Promise<void>;
  onUploadEvidence?: (
    entry: CaseIncidentEntry,
    file: File,
    meta?: IncidentEvidenceUploadMeta,
  ) => Promise<CaseIncidentEntry>;
  heading: string;
};

export function IncidentEntryDialog({ open, onOpenChange, initialEntry, onSave, onUploadEvidence, heading }: Props) {
  const [entry, setEntry] = useState<CaseIncidentEntry>(initialEntry);
  const [evidencePendingFiles, setEvidencePendingFiles] = useState<Map<string, File>>(() => new Map());
  const [savingIncident, setSavingIncident] = useState(false);
  const [uploadingEvidence, setUploadingEvidence] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  /** Always hold latest draft from parent; sync into state only when `open` flips true (deps must not include `initialEntry` or file picks can be wiped mid-session). */
  const initialEntryRef = useRef(initialEntry);
  initialEntryRef.current = initialEntry;

  useEffect(() => {
    if (!open) return;
    setEntry(initialEntryRef.current);
    setUploadError(null);
    setEvidencePendingFiles(new Map());
    setSavedAt(null);
  }, [open]);

  function setPendingForRow(rowId: string, file: File | null) {
    setEvidencePendingFiles((prev) => {
      const next = new Map(prev);
      if (file) next.set(rowId, file);
      else next.delete(rowId);
      return next;
    });
    setSavedAt(null);
  }

  const stateVal = entry.state?.trim() ?? "";

  async function handleSaveIncident() {
    setUploadError(null);
    setSavingIncident(true);
    try {
      const cleaned: CaseIncidentEntry = {
        ...entry,
        evidence_items: stripEmptyEvidenceItems(entry.evidence_items),
      };
      await Promise.resolve(onSave(cleaned));
      setEntry(cleaned);
      setSavedAt(new Date().toISOString());
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSavingIncident(false);
    }
  }

  async function handleUploadEvidence() {
    setUploadError(null);
    if (!onUploadEvidence) {
      setUploadError("File upload is not available here. Remove selected files or add references only.");
      return;
    }
    if (evidencePendingFiles.size === 0) {
      return;
    }
    setUploadingEvidence(true);
    try {
      // Persist the incident first so evidence links are attached to this case incident.
      const base: CaseIncidentEntry = {
        ...entry,
        evidence_items: stripEmptyEvidenceItems(entry.evidence_items),
      };
      await Promise.resolve(onSave(base));

      let next = base;
      for (const row of next.evidence_items) {
        const file = evidencePendingFiles.get(row.id);
        if (!file) continue;
        next = await onUploadEvidence(next, file, { replaceRowId: row.id });
      }
      setEntry(next);
      setEvidencePendingFiles(new Map());
      setSavedAt(new Date().toISOString());
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Failed to upload evidence for this incident.");
    } finally {
      setUploadingEvidence(false);
    }
  }

  return (
    <Dialog modal={false} open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!flex max-h-[min(92vh,880px)] min-h-0 w-[min(96vw,56rem)] max-w-[min(96vw,56rem)] translate-y-[-50%] flex-col gap-0 overflow-hidden p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-4 text-left">
          <DialogTitle className="text-foreground">{heading}</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Enter everything for this incident in one place. Add more incidents from the main form when you are done here.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5 space-y-8">
          {uploadError ? <p className="text-sm text-destructive">{uploadError}</p> : null}

          <section className="space-y-4 rounded-md border border-border/80 bg-panel/15 p-4">
            <h3 className="text-sm font-semibold text-foreground">Incident</h3>
            <div className="space-y-2">
              <Label className="text-foreground">Incident title or type</Label>
              <Input
                className={inputClass}
                placeholder="e.g. Traffic stop, Home search"
                value={entry.incident_title}
                onChange={(e) => {
                  setEntry({ ...entry, incident_title: e.target.value });
                  setSavedAt(null);
                }}
              />
            </div>
            <CasePeopleRows
              value={entry.people}
              onChange={(people) => {
                setEntry({ ...entry, people });
                setSavedAt(null);
              }}
            />
            <div className="space-y-2">
              <Label className="text-foreground">What happened</Label>
              <Textarea
                className={`${inputClass} min-h-[140px]`}
                placeholder="Facts, context, and key details for this incident."
                value={entry.description}
                onChange={(e) => {
                  setEntry({ ...entry, description: e.target.value });
                  setSavedAt(null);
                }}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-foreground">Date (optional)</Label>
                <Input
                  className={inputClass}
                  type="date"
                  value={entry.date ?? ""}
                  onChange={(e) => {
                    setEntry({ ...entry, date: e.target.value.trim() ? e.target.value : null });
                    setSavedAt(null);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">Year (optional)</Label>
                <Input
                  className={inputClass}
                  type="number"
                  min={1800}
                  max={2100}
                  placeholder="If no exact date"
                  value={entry.year ?? ""}
                  onChange={(e) => {
                    const v = e.target.value.trim();
                    const n = v ? Number.parseInt(v, 10) : NaN;
                    setEntry({
                      ...entry,
                      year: v && Number.isFinite(n) ? n : null,
                    });
                    setSavedAt(null);
                  }}
                />
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-foreground">Location</Label>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-foreground">State</Label>
                  <Select
                    value={stateVal || "__none__"}
                    onValueChange={(v) => {
                      if (v === "__none__") setEntry({ ...entry, state: "", city: "" });
                      else setEntry({ ...entry, state: v, city: "" });
                      setSavedAt(null);
                    }}
                  >
                    <SelectTrigger className={inputClass}>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[min(60vh,320px)]">
                      <SelectItem value="__none__">—</SelectItem>
                      {US_STATE_OPTIONS.filter((o) => o.value).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="incident-city" className="text-foreground">
                    City
                  </Label>
                  <CityCombobox
                    id="incident-city"
                    stateCode={stateVal}
                    value={entry.city ?? ""}
                    onChange={(city) => {
                      setEntry({ ...entry, city });
                      setSavedAt(null);
                    }}
                    className={inputClass}
                    placeholder={stateVal ? "Search or type a city" : "City (select state first for suggestions)"}
                  />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-foreground">Address line 1</Label>
                  <Input
                    className={inputClass}
                    placeholder="Street address or primary location"
                    value={entry.address_line_1 ?? ""}
                    onChange={(e) => {
                      setEntry({ ...entry, address_line_1: e.target.value });
                      setSavedAt(null);
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">Address line 2</Label>
                  <Input
                    className={inputClass}
                    placeholder="Suite, floor, apartment, room, office, etc."
                    value={entry.address_line_2 ?? ""}
                    onChange={(e) => {
                      setEntry({ ...entry, address_line_2: e.target.value });
                      setSavedAt(null);
                    }}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-2 rounded-md border border-border/80 bg-panel/15 p-4">
            <Label className="text-foreground">Charges (this incident)</Label>
            <Textarea
              className={`${inputClass} min-h-[120px]`}
              placeholder="Formal or alleged charges tied to this incident."
              value={entry.charges}
              onChange={(e) => {
                setEntry({ ...entry, charges: e.target.value });
                setSavedAt(null);
              }}
            />
          </section>

          <CaseLegalMilestoneRows
            value={entry.legal_milestones}
            onChange={(legal_milestones) => {
              setEntry({ ...entry, legal_milestones });
              setSavedAt(null);
            }}
          />

          <CaseEvidenceFileRows
            value={entry.evidence_items}
            onChange={(evidence_items) => {
              setEntry({ ...entry, evidence_items });
              setSavedAt(null);
            }}
            pendingFiles={evidencePendingFiles}
            onPendingFileChange={setPendingForRow}
            fileUploadEnabled={Boolean(onUploadEvidence)}
          />
        </div>

        <DialogFooter className="shrink-0 border-t border-border px-6 py-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={savingIncident || uploadingEvidence}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={savingIncident || uploadingEvidence || evidencePendingFiles.size === 0 || !onUploadEvidence}
            onClick={() => void handleUploadEvidence()}
          >
            {uploadingEvidence ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Uploading…
              </span>
            ) : (
              "Upload files"
            )}
          </Button>
          <Button
            type="button"
            className="bg-primary text-primary-foreground"
            disabled={savingIncident || uploadingEvidence}
            onClick={() => void handleSaveIncident()}
          >
            {savingIncident ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Saving…
              </span>
            ) : (
              "Save incident"
            )}
          </Button>
          {savedAt ? <span className="text-sm text-muted-foreground">Saved</span> : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
