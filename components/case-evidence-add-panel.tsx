"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileUp, Files, Link2 } from "lucide-react";
import { EvidenceSourceFields } from "@/components/evidence-source-fields";
import { parseEvidenceSourceFromFormData } from "@/lib/evidence-source";
import type { DuplicateEvidenceMatch } from "@/lib/evidence-upload-errors";

function existingEvidenceHref(e: DuplicateEvidenceMatch) {
  if (e.case_id) return `/cases/${e.case_id}/evidence/${e.id}`;
  return `/evidence/${e.id}`;
}

type RowStatus = "pending" | "uploading" | "done" | "error";

type FileRow = {
  name: string;
  status: RowStatus;
  detail?: string;
};

export function CaseEvidenceAddPanel({
  caseId,
  mode = "case",
}: {
  caseId?: string;
  /** `library` uploads to the database without a case (personal evidence pool). */
  mode?: "case" | "library";
}) {
  const router = useRouter();
  if (mode === "case" && !caseId) {
    throw new Error("CaseEvidenceAddPanel requires caseId when mode is case.");
  }
  const apiEvidence = mode === "library" ? "/api/library/evidence" : `/api/cases/${caseId!}/evidence`;
  const apiFromUrl =
    mode === "library" ? "/api/library/evidence/from-url" : `/api/cases/${caseId!}/evidence/from-url`;
  const [singleError, setSingleError] = useState<string | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);

  const [bulkRows, setBulkRows] = useState<FileRow[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlInfo, setUrlInfo] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);

  const [dupSingle, setDupSingle] = useState<DuplicateEvidenceMatch | null>(null);
  const [forceNextSingle, setForceNextSingle] = useState(false);
  const [urlDup, setUrlDup] = useState<DuplicateEvidenceMatch | null>(null);
  const [forceNextUrl, setForceNextUrl] = useState(false);

  async function onSingleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSingleError(null);
    setDupSingle(null);
    const form = e.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      setSingleError("Choose a file.");
      return;
    }
    setSingleLoading(true);
    const fd = new FormData(form);
    if (forceNextSingle) {
      fd.set("force_duplicate", "true");
    }
    const res = await fetch(apiEvidence, {
      method: "POST",
      body: fd,
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      warning?: string;
      duplicate?: boolean;
      existing?: DuplicateEvidenceMatch;
    };
    setSingleLoading(false);
    if (res.status === 409 && data.duplicate && data.existing) {
      setDupSingle(data.existing);
      setForceNextSingle(false);
      return;
    }
    if (!res.ok) {
      setSingleError(data.error ?? "Upload failed");
      return;
    }
    setForceNextSingle(false);
    form.reset();
    router.refresh();
  }

  async function onBulkSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBulkError(null);
    const form = e.currentTarget;
    const input = form.elements.namedItem("files") as HTMLInputElement;
    const files = input.files;
    if (!files?.length) {
      setBulkError("Choose one or more files.");
      return;
    }
    const arr = Array.from(files);
    setBulkRows(arr.map((f) => ({ name: f.name, status: "pending" as const })));
    setBulkLoading(true);

    const sourcePayload = parseEvidenceSourceFromFormData(new FormData(form));

    for (let i = 0; i < arr.length; i++) {
      setBulkRows((prev) =>
        prev.map((r, j) => (j === i ? { ...r, status: "uploading" as const, detail: "Validating & scanning…" } : r)),
      );
      const fd = new FormData();
      fd.set("file", arr[i]!);
      fd.set("source_type", sourcePayload.source_type);
      fd.set("source_platform", sourcePayload.source_platform ?? "");
      fd.set("source_program", sourcePayload.source_program ?? "");
      fd.set("source_url", sourcePayload.source_url ?? "");
      const res = await fetch(apiEvidence, {
        method: "POST",
        body: fd,
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        warning?: string;
        id?: string;
        duplicate?: boolean;
        existing?: DuplicateEvidenceMatch;
      };
      if (res.status === 409 && data.duplicate && data.existing) {
        setBulkRows((prev) =>
          prev.map((r, j) =>
            j === i
              ? {
                  ...r,
                  status: "error" as const,
                  detail: `Duplicate — see ${data.existing!.display_filename ?? data.existing!.original_filename}`,
                }
              : r,
          ),
        );
        continue;
      }
      if (!res.ok) {
        setBulkRows((prev) =>
          prev.map((r, j) =>
            j === i
              ? { ...r, status: "error" as const, detail: data.error ?? "Blocked or rejected" }
              : r,
          ),
        );
        continue;
      }
      const detail = data.warning ? `Accepted (note: ${data.warning})` : "Accepted · extracted";
      setBulkRows((prev) =>
        prev.map((r, j) => (j === i ? { ...r, status: "done" as const, detail } : r)),
      );
    }

    setBulkLoading(false);
    form.reset();
    router.refresh();
    window.setTimeout(() => setBulkRows([]), 4000);
  }

  async function onUrlSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUrlError(null);
    setUrlInfo(null);
    setUrlDup(null);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const trimmed = String(fd.get("url") ?? "").trim();
    if (!trimmed) {
      setUrlError("Paste a link to a web page or document.");
      return;
    }
    const source = parseEvidenceSourceFromFormData(fd);
    setUrlLoading(true);
    const res = await fetch(apiFromUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: trimmed,
        source_type: source.source_type,
        source_platform: source.source_platform,
        source_program: source.source_program,
        source_url: source.source_url?.trim() || trimmed,
        force_duplicate: forceNextUrl,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      warning?: string;
      duplicate?: boolean;
      existing?: DuplicateEvidenceMatch;
    };
    setUrlLoading(false);
    if (res.status === 409 && data.duplicate && data.existing) {
      setUrlDup(data.existing);
      setForceNextUrl(false);
      return;
    }
    if (!res.ok) {
      setUrlError(data.error ?? "Could not import from that address.");
      return;
    }
    setForceNextUrl(false);
    form.reset();
    setUrlInfo(data.warning ? `Imported with a note: ${data.warning}` : "Imported. Open the new evidence item to review text and run analysis.");
    router.refresh();
    window.setTimeout(() => setUrlInfo(null), 8000);
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-400/90 mb-1">
          {mode === "library" ? "Upload to database" : "Upload to case"}
        </p>
        <h3 className="text-sm font-semibold tracking-tight text-foreground">Add evidence</h3>
        <p className="text-xs text-muted-foreground mt-1">
          {mode === "library"
            ? "Files are stored in your evidence library immediately — no case required. You can assign them to a case later from the evidence page."
            : "Upload from your device or import text from a public web page or file link. Each item becomes its own evidence file; run AI analysis on the evidence page when ready."}
        </p>
        <p className="text-xs text-amber-200/85 border border-amber-500/25 rounded-md px-3 py-2 bg-amber-500/[0.06] mt-2">
          <strong className="font-medium text-amber-100/95">Security:</strong> every file is validated and scanned
          before it is accepted. Blocked files are not stored. Allowed types include PDF, text, Office, images, and
          common audio/video — not executables or archives.
        </p>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <FileUp className="h-4 w-4 text-sky-400/90 shrink-0" aria-hidden />
          Upload file
        </div>
        <p className="text-xs text-muted-foreground">
          One document from your computer (PDF or text extracts best). While uploading: validate → scan → store →
          extract.
        </p>
        <form onSubmit={onSingleSubmit} className="space-y-3">
          {dupSingle ? (
            <Alert className="border-amber-500/40 bg-amber-950/25 text-amber-100/95">
              <AlertDescription className="text-sm space-y-2">
                <p>This evidence appears to already exist in the database.</p>
                <Link href={existingEvidenceHref(dupSingle)} className="text-sky-400 hover:underline font-medium">
                  Open existing ({dupSingle.display_filename ?? dupSingle.original_filename})
                </Link>
                <label className="flex items-start gap-2 cursor-pointer text-xs text-zinc-300 pt-1">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={forceNextSingle}
                    onChange={(ev) => setForceNextSingle(ev.target.checked)}
                  />
                  Upload a new copy anyway (acknowledge duplicate)
                </label>
              </AlertDescription>
            </Alert>
          ) : null}
          {singleError ? (
            <Alert variant="destructive">
              <AlertDescription>{singleError}</AlertDescription>
            </Alert>
          ) : null}
          <EvidenceSourceFields idPrefix="single" />
          <div className="space-y-2">
            <Label htmlFor="evidence-single-file" className="sr-only">
              Choose file
            </Label>
            <Input
              id="evidence-single-file"
              name="file"
              type="file"
              className="cursor-pointer bg-zinc-900/80 border-zinc-700"
            />
          </div>
          <Button
            type="submit"
            disabled={singleLoading || (!!dupSingle && !forceNextSingle)}
            size="sm"
            title={dupSingle && !forceNextSingle ? "Check “upload a new copy” or open the existing file above." : undefined}
          >
            {singleLoading ? "Validating & scanning…" : "Upload & extract"}
          </Button>
        </form>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Files className="h-4 w-4 text-sky-400/90 shrink-0" aria-hidden />
          Upload multiple files
        </div>
        <p className="text-xs text-muted-foreground">
          Select several files at once. Each file is stored separately and text is extracted like a normal
          upload.
        </p>
        <form onSubmit={onBulkSubmit} className="space-y-3">
          {bulkError ? (
            <Alert variant="destructive">
              <AlertDescription>{bulkError}</AlertDescription>
            </Alert>
          ) : null}
          <EvidenceSourceFields idPrefix="bulk" />
          <div className="space-y-2">
            <Label htmlFor="evidence-multi-files" className="sr-only">
              Choose multiple files
            </Label>
            <Input
              id="evidence-multi-files"
              name="files"
              type="file"
              multiple
              className="cursor-pointer bg-zinc-900/80 border-zinc-700"
            />
          </div>
          {bulkRows.length > 0 ? (
            <ul className="text-xs space-y-1 rounded border border-zinc-800 bg-zinc-900/50 p-2 max-h-40 overflow-y-auto">
              {bulkRows.map((r, i) => (
                <li key={`${r.name}-${i}`} className="flex justify-between gap-2">
                  <span className="truncate text-muted-foreground">{r.name}</span>
                  <span
                    className={
                      r.status === "done"
                        ? "text-emerald-400/90"
                        : r.status === "error"
                          ? "text-destructive"
                          : r.status === "uploading"
                            ? "text-amber-400/90"
                            : "text-muted-foreground"
                    }
                  >
                    {r.status === "pending"
                      ? "Queued"
                      : r.status === "uploading"
                        ? "Uploading…"
                        : r.status === "done"
                          ? r.detail ?? "Done"
                          : r.detail ?? "Failed"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
          <Button type="submit" disabled={bulkLoading} size="sm" variant="secondary">
            {bulkLoading ? "Working…" : "Upload all & extract"}
          </Button>
        </form>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <Link2 className="h-4 w-4 text-sky-400/90 shrink-0" aria-hidden />
          Import from URL
        </div>
        <p className="text-xs text-muted-foreground">
          Paste a public <strong className="font-medium text-zinc-300">https://</strong> link to a web page,
          text document, or PDF. We fetch visible text where possible and save it as evidence (same
          extraction pipeline as uploads).
        </p>
        <form onSubmit={onUrlSubmit} className="space-y-3">
          {urlDup ? (
            <Alert className="border-amber-500/40 bg-amber-950/25 text-amber-100/95">
              <AlertDescription className="text-sm space-y-2">
                <p>This evidence appears to already exist in the database.</p>
                <Link href={existingEvidenceHref(urlDup)} className="text-sky-400 hover:underline font-medium">
                  Open existing ({urlDup.display_filename ?? urlDup.original_filename})
                </Link>
                <label className="flex items-start gap-2 cursor-pointer text-xs text-zinc-300 pt-1">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={forceNextUrl}
                    onChange={(ev) => setForceNextUrl(ev.target.checked)}
                  />
                  Import a new copy anyway (acknowledge duplicate)
                </label>
              </AlertDescription>
            </Alert>
          ) : null}
          {urlInfo ? (
            <Alert className="border-emerald-900/50 bg-emerald-950/30 text-emerald-100/90">
              <AlertDescription>{urlInfo}</AlertDescription>
            </Alert>
          ) : null}
          {urlError ? (
            <Alert variant="destructive">
              <AlertDescription>{urlError}</AlertDescription>
            </Alert>
          ) : null}
          <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
            <div className="flex-1 space-y-2">
              <Label htmlFor="evidence-url">Web address</Label>
              <Input
                id="evidence-url"
                name="url"
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://example.com/report or link to a .pdf"
                className="bg-zinc-900/80 border-zinc-700"
              />
            </div>
            <Button
              type="submit"
              disabled={urlLoading || (!!urlDup && !forceNextUrl)}
              size="sm"
              className="shrink-0"
              title={urlDup && !forceNextUrl ? "Check “import a new copy” or open the existing file above." : undefined}
            >
              {urlLoading ? "Importing…" : "Import"}
            </Button>
          </div>
          <EvidenceSourceFields idPrefix="url" />
        </form>
      </div>
    </div>
  );
}
