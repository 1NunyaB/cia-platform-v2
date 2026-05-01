"use client";

import { useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CaseEvidenceFileEntry } from "@/lib/case-directory";
import { FileUp, Plus, Trash2, X } from "lucide-react";

const inputClass = "border-input bg-form-field text-form-field-foreground";

function newEntry(): CaseEvidenceFileEntry {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `ref_${Math.random().toString(36).slice(2)}`,
    label: "",
    file_reference: "",
    notes: "",
    evidence_id: null,
  };
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Button + hidden file input (no Radix Slot / label nesting). Programmatic click is deferred so it plays
 * nicely with modal layers and the OS file picker.
 */
function EvidenceRowFilePicker({ onFileSelected }: { onFileSelected: (file: File) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="shrink-0"
        onClick={() => {
          window.setTimeout(() => {
            inputRef.current?.click();
          }, 0);
        }}
      >
        <FileUp className="h-4 w-4" aria-hidden />
        Choose file
      </Button>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          try {
            const file = e.target.files?.[0] ?? null;
            if (file) onFileSelected(file);
          } finally {
            e.target.value = "";
          }
        }}
      />
    </>
  );
}

export function CaseEvidenceFileRows({
  value,
  onChange,
  pendingFiles,
  onPendingFileChange,
  fileUploadEnabled = true,
}: {
  /** Same as “evidence items”: persisted as `evidence_file_entries` on save. */
  value: CaseEvidenceFileEntry[];
  onChange: (next: CaseEvidenceFileEntry[]) => void;
  /** Client-only files chosen per row; uploaded when the incident is saved. */
  pendingFiles?: ReadonlyMap<string, File>;
  onPendingFileChange?: (rowId: string, file: File | null) => void;
  /** When false, hide the file picker (e.g. no upload handler). */
  fileUploadEnabled?: boolean;
}) {
  const pending = pendingFiles ?? new Map<string, File>();

  return (
    <div className="space-y-3 rounded-md border border-border/80 bg-panel/20 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Evidence</h3>
          <p className="text-xs text-muted-foreground">
            One file per row. Use <span className="font-medium text-foreground/90">Add evidence</span> to attach more
            files to this same incident. References-only rows are fine. Use the incident dialog&apos;s
            <span className="font-medium text-foreground/90"> Upload files</span> button after saving details.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...value, newEntry()])}
          aria-label="Add another evidence row for an additional file or reference"
        >
          <Plus className="h-4 w-4 mr-1" />
          Add evidence
        </Button>
      </div>
      {value.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No rows yet. Add a row to pick a file, or add several rows for multiple files—each row stays on this
          incident.
        </p>
      ) : (
        value.map((row, i) => {
          const filePending = pending.get(row.id) ?? null;
          const hasEvidenceId = Boolean(row.evidence_id && String(row.evidence_id).trim());

          let displayName: string | null = null;
          if (filePending) {
            const n = filePending.name;
            displayName = typeof n === "string" && n.length > 0 ? n : "Selected file";
          } else if (hasEvidenceId) {
            const t = row.label?.trim() ?? "";
            displayName = t.length > 0 ? t : "Uploaded file";
          } else {
            const t = row.label?.trim() ?? "";
            displayName = t.length > 0 ? t : null;
          }

          const sizeHint = filePending && Number.isFinite(filePending.size) ? formatFileSize(filePending.size) : "";

          return (
            <div key={row.id} className="rounded-md border border-border bg-panel/40 p-3 space-y-3">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  aria-label="Remove evidence row"
                  onClick={() => {
                    onPendingFileChange?.(row.id, null);
                    onChange(value.filter((_, j) => j !== i));
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              {fileUploadEnabled ? (
                <div className="space-y-2">
                  <Label className="text-foreground">File</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <EvidenceRowFilePicker
                      onFileSelected={(file) => {
                        onPendingFileChange?.(row.id, file);
                        const copy = [...value];
                        const nextLabel = row.label.trim() ? row.label : file.name;
                        copy[i] = { ...row, label: nextLabel };
                        onChange(copy);
                      }}
                    />
                    {filePending || hasEvidenceId ? (
                      <span className="min-w-0 flex-1 text-sm text-foreground" title={displayName ?? undefined}>
                        {filePending ? (
                          <span className="text-muted-foreground">Selected: </span>
                        ) : (
                          <span className="text-muted-foreground">Attached: </span>
                        )}
                        <span className="break-all">{displayName ?? "—"}</span>
                        {sizeHint ? (
                          <span className="text-muted-foreground"> ({sizeHint})</span>
                        ) : null}
                      </span>
                    ) : null}
                    {filePending ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        aria-label="Clear selected file"
                        onClick={() => onPendingFileChange?.(row.id, null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">File upload is not available in this context.</p>
              )}

              <div className="space-y-2">
                <Label className="text-foreground">
                  Title <span className="text-muted-foreground font-normal">(optional override)</span>
                </Label>
                <Input
                  className={inputClass}
                  placeholder="Defaults to the file name when you choose a file"
                  value={row.label ?? ""}
                  onChange={(e) => {
                    const copy = [...value];
                    copy[i] = { ...row, label: e.target.value };
                    onChange(copy);
                  }}
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">
                  Notes <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Textarea
                  className={`${inputClass} min-h-[72px]`}
                  placeholder="What it is or why it matters"
                  value={row.notes ?? ""}
                  onChange={(e) => {
                    const copy = [...value];
                    copy[i] = { ...row, notes: e.target.value };
                    onChange(copy);
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-foreground">
                  Reference or link <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  className={inputClass}
                  placeholder="URL, docket #, volume/page, Bates range, etc."
                  value={row.file_reference ?? ""}
                  onChange={(e) => {
                    const copy = [...value];
                    copy[i] = { ...row, file_reference: e.target.value };
                    onChange(copy);
                  }}
                  autoComplete="off"
                />
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
