"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EvidenceSourceFields } from "@/components/evidence-source-fields";
import { parseEvidenceSourceFromFormData } from "@/lib/evidence-source";
import type { DuplicateEvidenceMatch } from "@/lib/evidence-upload-errors";
import { cn } from "@/lib/utils";

function existingEvidenceHref(e: DuplicateEvidenceMatch) {
  if (e.case_id) return `/cases/${e.case_id}/evidence/${e.id}`;
  return `/evidence/${e.id}`;
}

function useIntakeApi(mode: "case" | "library", caseId: string | undefined) {
  if (mode === "case" && !caseId) throw new Error("caseId required for case mode");
  const apiEvidence = mode === "library" ? "/api/library/evidence" : `/api/cases/${caseId!}/evidence`;
  const apiFromUrl =
    mode === "library" ? "/api/library/evidence/from-url" : `/api/cases/${caseId!}/evidence/from-url`;
  return { apiEvidence, apiFromUrl };
}

type RowStatus = "pending" | "uploading" | "done" | "error";

type FileRow = {
  name: string;
  status: RowStatus;
  detail?: string;
};

const securityNoticeClass =
  "rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 leading-relaxed";

const duplicateAlertClass =
  "border-amber-300 bg-amber-50 text-amber-950 [&_a]:text-red-700 [&_a]:underline";

const successAlertClass = "border-emerald-200 bg-emerald-50 text-emerald-950";

type IntakeProps = {
  mode: "case" | "library";
  caseId?: string;
};

export function EvidenceIntakeSingleForm({ mode, caseId }: IntakeProps) {
  const router = useRouter();
  const { apiEvidence } = useIntakeApi(mode, caseId);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [dupSingle, setDupSingle] = useState<DuplicateEvidenceMatch | null>(null);
  const [forceNextSingle, setForceNextSingle] = useState(false);

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

  return (
    <div className="space-y-6">
      <p className={securityNoticeClass}>
        <strong className="font-semibold">Security:</strong> every file is validated and scanned before it is
        accepted. Blocked files are not stored. Allowed types include PDF, text, Office, images, and common
        audio/video — not executables or archives.
      </p>

      <form onSubmit={onSingleSubmit} className="space-y-6">
        {dupSingle ? (
          <Alert className={duplicateAlertClass}>
            <AlertDescription className="text-sm space-y-2 text-amber-950">
              <p>This evidence appears to already exist in the database.</p>
              <Link href={existingEvidenceHref(dupSingle)} className="font-medium text-red-700 hover:underline">
                Open existing ({dupSingle.display_filename ?? dupSingle.original_filename})
              </Link>
              <label className="flex items-start gap-2 cursor-pointer text-xs pt-1">
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
          <Alert variant="destructive" className="border-red-300 bg-red-50 text-red-900 [&_*]:text-red-900">
            <AlertDescription>{singleError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="evidence-intake-single-file" className="text-zinc-900">
            File
          </Label>
          <Input
            id="evidence-intake-single-file"
            name="file"
            type="file"
            className="cursor-pointer border-zinc-300 bg-white text-zinc-950 file:mr-3 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:text-zinc-900"
          />
        </div>

        <EvidenceSourceFields idPrefix="intake-single" variant="intake" />

        <Button
          type="submit"
          disabled={singleLoading || (!!dupSingle && !forceNextSingle)}
          className="w-full sm:w-auto bg-zinc-950 text-white hover:bg-zinc-800"
          title={
            dupSingle && !forceNextSingle ? "Check “upload a new copy” or open the existing file above." : undefined
          }
        >
          {singleLoading ? "Validating & scanning…" : "Upload & extract"}
        </Button>
      </form>
    </div>
  );
}

export function EvidenceIntakeBulkForm({ mode, caseId }: IntakeProps) {
  const router = useRouter();
  const { apiEvidence } = useIntakeApi(mode, caseId);
  const [bulkRows, setBulkRows] = useState<FileRow[]>([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

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
            j === i ? { ...r, status: "error" as const, detail: data.error ?? "Blocked or rejected" } : r,
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

  return (
    <div className="space-y-6">
      <p className={securityNoticeClass}>
        <strong className="font-semibold">Security:</strong> each file is validated and scanned. Blocked files are
        not stored. Allowed types include PDF, text, Office, images, and common audio/video — not executables or
        archives.
      </p>

      <form onSubmit={onBulkSubmit} className="space-y-6">
        {bulkError ? (
          <Alert variant="destructive" className="border-red-300 bg-red-50 text-red-900 [&_*]:text-red-900">
            <AlertDescription>{bulkError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="evidence-intake-multi-files" className="text-zinc-900">
            Files
          </Label>
          <Input
            id="evidence-intake-multi-files"
            name="files"
            type="file"
            multiple
            className="cursor-pointer border-zinc-300 bg-white text-zinc-950 file:mr-3 file:rounded file:border-0 file:bg-zinc-100 file:px-3 file:py-1.5 file:text-sm file:text-zinc-900"
          />
          <p className="text-xs text-zinc-600">Each file is stored separately with the same source metadata below.</p>
        </div>

        <EvidenceSourceFields idPrefix="intake-bulk" variant="intake" />

        {bulkRows.length > 0 ? (
          <div
            className={cn(
              "rounded-lg border border-sky-200 bg-sky-50 p-3 max-h-48 overflow-y-auto",
              "text-sm text-zinc-900",
            )}
          >
            <p className="text-xs font-medium text-zinc-700 mb-2">Upload progress</p>
            <ul className="space-y-1.5 text-xs">
              {bulkRows.map((r, i) => (
                <li key={`${r.name}-${i}`} className="flex justify-between gap-2">
                  <span className="truncate text-zinc-800">{r.name}</span>
                  <span
                    className={
                      r.status === "done"
                        ? "text-emerald-800 shrink-0"
                        : r.status === "error"
                          ? "text-red-700 shrink-0 font-medium"
                          : r.status === "uploading"
                            ? "text-amber-800 shrink-0"
                            : "text-zinc-500 shrink-0"
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
          </div>
        ) : null}

        <Button
          type="submit"
          disabled={bulkLoading}
          variant="secondary"
          className="w-full sm:w-auto border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-100"
        >
          {bulkLoading ? "Working…" : "Upload all & extract"}
        </Button>
      </form>
    </div>
  );
}

export function EvidenceIntakeUrlForm({ mode, caseId }: IntakeProps) {
  const router = useRouter();
  const { apiFromUrl } = useIntakeApi(mode, caseId);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlInfo, setUrlInfo] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlDup, setUrlDup] = useState<DuplicateEvidenceMatch | null>(null);
  const [forceNextUrl, setForceNextUrl] = useState(false);

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
      <p className="text-sm text-zinc-700">
        Paste a public <strong className="font-semibold text-zinc-950">https://</strong> link. We fetch visible text
        where possible and run the same extraction pipeline as file uploads.
      </p>

      <form onSubmit={onUrlSubmit} className="space-y-6">
        {urlDup ? (
          <Alert className={duplicateAlertClass}>
            <AlertDescription className="text-sm space-y-2 text-amber-950">
              <p>This evidence appears to already exist in the database.</p>
              <Link href={existingEvidenceHref(urlDup)} className="font-medium text-red-700 hover:underline">
                Open existing ({urlDup.display_filename ?? urlDup.original_filename})
              </Link>
              <label className="flex items-start gap-2 cursor-pointer text-xs pt-1">
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
          <Alert className={successAlertClass}>
            <AlertDescription className="text-emerald-950">{urlInfo}</AlertDescription>
          </Alert>
        ) : null}
        {urlError ? (
          <Alert variant="destructive" className="border-red-300 bg-red-50 text-red-900 [&_*]:text-red-900">
            <AlertDescription>{urlError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="evidence-intake-url" className="text-zinc-900">
            Web address
          </Label>
          <Input
            id="evidence-intake-url"
            name="url"
            type="url"
            inputMode="url"
            autoComplete="url"
            placeholder="https://example.com/report or link to a .pdf"
            className="border-zinc-300 bg-white text-zinc-950"
          />
        </div>

        <EvidenceSourceFields idPrefix="intake-url" variant="intake" />

        <Button
          type="submit"
          disabled={urlLoading || (!!urlDup && !forceNextUrl)}
          className="w-full sm:w-auto bg-zinc-950 text-white hover:bg-zinc-800"
          title={urlDup && !forceNextUrl ? "Check “import a new copy” or open the existing file above." : undefined}
        >
          {urlLoading ? "Importing…" : "Import"}
        </Button>
      </form>
    </div>
  );
}
