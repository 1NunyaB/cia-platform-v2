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
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";
import { cn } from "@/lib/utils";
import { emitExtractionReminder } from "@/lib/extraction-reminder-event";
import {
  isExtractionSoftFailureNotice,
  UPLOAD_DEFERRED_EXTRACTION_CLIENT_MESSAGE,
} from "@/lib/extraction-user-messages";
import { InvestigationLoadingIndicator } from "@/components/investigation-loading-indicator";

function existingEvidenceHref(e: DuplicateEvidenceMatch) {
  if (e.case_id) return `/cases/${e.case_id}/evidence/${e.id}`;
  return `/evidence/${e.id}`;
}

/**
 * Library routes: no case context. Case routes: `caseId` set and attachToCurrentCase true.
 * When `mode === "case"` and attachToCurrentCase is false, uploads use library APIs (case_id null).
 */
function useIntakeApi(
  mode: "case" | "library",
  caseId: string | undefined,
  attachToCurrentCase = true,
) {
  const useLibraryEndpoints = mode === "library" || (mode === "case" && !attachToCurrentCase);
  if (!useLibraryEndpoints && (!caseId || mode !== "case")) {
    throw new Error("caseId required when attaching uploads to a case");
  }
  const apiEvidence = useLibraryEndpoints ? "/api/library/evidence" : `/api/cases/${caseId!}/evidence`;
  const apiFromUrl = useLibraryEndpoints
    ? "/api/library/evidence/from-url"
    : `/api/cases/${caseId!}/evidence/from-url`;
  return { apiEvidence, apiFromUrl };
}

function CaseUploadDestinationField({
  idPrefix,
  attachToCurrentCase,
  onAttachChange,
}: {
  idPrefix: string;
  attachToCurrentCase: boolean;
  onAttachChange: (value: boolean) => void;
}) {
  return (
    <fieldset className="space-y-3 rounded-lg border border-border bg-card p-4">
      <legend className="text-sm font-medium text-foreground px-1">Where should this go?</legend>
      <div className="space-y-2 text-sm text-muted-foreground">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="radio"
            className="mt-1"
            name={`${idPrefix}-dest`}
            checked={attachToCurrentCase}
            onChange={() => onAttachChange(true)}
          />
          <span>
            <span className="font-medium text-foreground">Add to this case</span>
            <span className="block text-xs text-muted-foreground">
              Evidence appears on the case and counts toward your contributions.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="radio"
            className="mt-1"
            name={`${idPrefix}-dest`}
            checked={!attachToCurrentCase}
            onChange={() => onAttachChange(false)}
          />
          <span>
            <span className="font-medium text-foreground">Personal library only</span>
            <span className="block text-xs text-muted-foreground">
              Stored under your account without attaching to this case. You can assign it later from the evidence
              detail page.
            </span>
          </span>
        </label>
      </div>
    </fieldset>
  );
}

type RowStatus = "pending" | "uploading" | "done" | "error" | "duplicate_info";

type FileRow = {
  name: string;
  status: RowStatus;
  detail?: string;
};

const securityNoticeClass =
  "rounded-lg border border-alert-border bg-alert px-4 py-3 text-sm text-alert-foreground leading-relaxed";

/** Informational duplicate: not a failure — no new row was created. */
const duplicateInfoAlertClass =
  "border-emerald-200 bg-emerald-50 text-emerald-950 [&_a]:text-blue-900 [&_a]:underline [&_button]:text-foreground";

const successAlertClass = "border-emerald-200 bg-emerald-50 text-emerald-950";

const deferredInfoAlertClass =
  "border-sky-300 bg-sky-50 text-foreground [&_a]:text-blue-900 [&_a]:underline";

function EvidenceBroadcastUploadHint() {
  return (
    <p className="text-xs leading-relaxed text-foreground rounded-md border border-sky-300/80 bg-sky-50/95 px-3 py-2.5 shadow-sm">
      <span className="font-semibold text-foreground">Podcasts & broadcasts: </span>
      prefer a transcript (text or PDF) when video isn&apos;t needed. Upload clips, screenshots, or images separately
      when visual evidence matters.
    </p>
  );
}

type IntakeProps = {
  mode: "case" | "library";
  caseId?: string;
};

export function EvidenceIntakeSingleForm({ mode, caseId }: IntakeProps) {
  const router = useRouter();
  const [attachToCurrentCase, setAttachToCurrentCase] = useState(true);
  const [runExtractionAfterUpload, setRunExtractionAfterUpload] = useState(true);
  const { apiEvidence } = useIntakeApi(mode, caseId, attachToCurrentCase);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [dupInfo, setDupInfo] = useState<{
    existing: DuplicateEvidenceMatch;
    needs_extraction?: boolean;
    message?: string;
  } | null>(null);
  const [dupExtractLoading, setDupExtractLoading] = useState(false);
  const [singleExtractionBanner, setSingleExtractionBanner] = useState<string | null>(null);

  async function onSingleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSingleError(null);
    setDupInfo(null);
    const form = e.currentTarget;
    const input = form.elements.namedItem("file") as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      setSingleError("Choose a file.");
      return;
    }
    setSingleLoading(true);
    setSingleExtractionBanner(null);
    const fd = new FormData(form);
    if (!runExtractionAfterUpload) {
      fd.set("defer_extraction", "true");
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
      needs_extraction?: boolean;
      message?: string;
      no_new_record?: boolean;
      id?: string;
      deferred_extraction?: boolean;
    };
    setSingleLoading(false);
    const existing = data.existing;
    const isDup = Boolean(data.duplicate && existing && (res.ok || res.status === 409));
    if (isDup && existing) {
      setDupInfo({
        existing,
        needs_extraction: data.needs_extraction,
        message: data.message,
      });
      return;
    }
    if (!res.ok) {
      setSingleError(data.error ?? "Upload failed");
      return;
    }
    if (data.deferred_extraction) {
      setSingleExtractionBanner(UPLOAD_DEFERRED_EXTRACTION_CLIENT_MESSAGE);
    } else if (data.warning) {
      setSingleExtractionBanner(data.warning);
    } else {
      setSingleExtractionBanner(null);
    }
    if (data.id && isExtractionSoftFailureNotice(data.warning)) {
      const href =
        mode === "case" && caseId && attachToCurrentCase
          ? `/cases/${caseId}/evidence/${data.id}`
          : `/evidence/${data.id}`;
      emitExtractionReminder({
        evidenceId: data.id,
        filename: file.name,
        href,
        caseId: mode === "case" && attachToCurrentCase && caseId ? caseId : undefined,
      });
    }
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

      <EvidenceBroadcastUploadHint />

      <form onSubmit={onSingleSubmit} className="space-y-6">
        {mode === "case" ? (
          <CaseUploadDestinationField
            idPrefix="intake-single"
            attachToCurrentCase={attachToCurrentCase}
            onAttachChange={setAttachToCurrentCase}
          />
        ) : null}
        {dupInfo ? (
          <Alert className={duplicateInfoAlertClass}>
            <AlertDescription className="text-sm space-y-3 text-emerald-950">
              <p className="font-semibold text-foreground">This file is already in your library</p>
              <p className="text-foreground">
                {dupInfo.message ??
                  "No duplicate record was created and your file was not uploaded again."}
              </p>
              <p className="text-foreground">
                <span className="font-medium text-foreground">Existing name: </span>
                {evidencePrimaryLabel({
                  display_filename: dupInfo.existing.display_filename,
                  original_filename: dupInfo.existing.original_filename,
                })}
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                <Button asChild variant="secondary" className="border-border bg-card text-foreground">
                  <Link href={existingEvidenceHref(dupInfo.existing)}>Open existing</Link>
                </Button>
                {dupInfo.needs_extraction ? (
                  <Button
                    type="button"
                    variant="default"
                    disabled={dupExtractLoading}
                    className="bg-sky-700 text-white hover:bg-sky-600 disabled:bg-sky-700 disabled:text-white"
                    onClick={async () => {
                      setDupExtractLoading(true);
                      try {
                        await fetch(`/api/evidence/${dupInfo.existing.id}/extract`, { method: "POST" });
                        router.push(existingEvidenceHref(dupInfo.existing));
                      } finally {
                        setDupExtractLoading(false);
                      }
                    }}
                  >
                    {dupExtractLoading ? <InvestigationLoadingIndicator inline label="Starting..." /> : "Re-run extraction"}
                  </Button>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground pt-1 border-t border-emerald-200/80 mt-2">
                Duplicate upload override is disabled for collaborative integrity.
              </p>
            </AlertDescription>
          </Alert>
        ) : null}
        {singleError ? (
          <Alert variant="destructive">
            <AlertDescription>{singleError}</AlertDescription>
          </Alert>
        ) : null}
        {singleExtractionBanner ? (
          <Alert
            className={
              singleExtractionBanner === UPLOAD_DEFERRED_EXTRACTION_CLIENT_MESSAGE
                ? deferredInfoAlertClass
                : successAlertClass
            }
          >
            <AlertDescription
              className={
                singleExtractionBanner === UPLOAD_DEFERRED_EXTRACTION_CLIENT_MESSAGE
                  ? "text-sm text-foreground"
                  : "text-sm text-emerald-950"
              }
            >
              {singleExtractionBanner}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="evidence-intake-single-file" className="text-foreground">
            File
          </Label>
          <Input
            id="evidence-intake-single-file"
            name="file"
            type="file"
            className="cursor-pointer border-input bg-form-field text-form-field-foreground file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-black"
          />
        </div>

        <EvidenceSourceFields idPrefix="intake-single" variant="intake" />

        <label className="flex items-start gap-2 cursor-pointer text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-1"
            checked={runExtractionAfterUpload}
            onChange={(ev) => setRunExtractionAfterUpload(ev.target.checked)}
          />
          <span>
            <span className="font-medium text-foreground">Run text extraction immediately after upload</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              Uncheck to store the file first and run extraction later from the evidence page (useful when loading
              evidence before going live).
            </span>
          </span>
        </label>

        <Button
          type="submit"
          disabled={singleLoading}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
          title={undefined}
        >
          {singleLoading ? (
            <InvestigationLoadingIndicator inline label="Scanning upload..." />
          ) : runExtractionAfterUpload ? (
            "Upload & extract"
          ) : (
            "Upload (extract later)"
          )}
        </Button>
      </form>
    </div>
  );
}

export function EvidenceIntakeBulkForm({ mode, caseId }: IntakeProps) {
  const router = useRouter();
  const [attachToCurrentCase, setAttachToCurrentCase] = useState(true);
  const [runExtractionAfterUpload, setRunExtractionAfterUpload] = useState(true);
  const { apiEvidence } = useIntakeApi(mode, caseId, attachToCurrentCase);
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
      if (!runExtractionAfterUpload) {
        fd.set("defer_extraction", "true");
      }
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
        message?: string;
        needs_extraction?: boolean;
        deferred_extraction?: boolean;
      };
      const existing = data.existing;
      const isDup = Boolean(data.duplicate && existing && (res.ok || res.status === 409));
      if (isDup && existing) {
        const label = evidencePrimaryLabel({
          display_filename: existing.display_filename,
          original_filename: existing.original_filename,
        });
        setBulkRows((prev) =>
          prev.map((r, j) =>
            j === i
              ? {
                  ...r,
                  status: "duplicate_info" as const,
                  detail:
                    data.message ??
                    `Already stored as “${label}” — no new upload. Open that item to review or re-run extraction.`,
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
      const detail = data.deferred_extraction
        ? "Accepted — extraction deferred (open file to extract)"
        : data.warning
          ? `Accepted — ${data.warning}`
          : "Accepted · extracted";
      if (data.id && isExtractionSoftFailureNotice(data.warning)) {
        const href =
          mode === "case" && caseId && attachToCurrentCase
            ? `/cases/${caseId}/evidence/${data.id}`
            : `/evidence/${data.id}`;
        emitExtractionReminder({
          evidenceId: data.id,
          filename: arr[i]!.name,
          href,
          caseId: mode === "case" && attachToCurrentCase && caseId ? caseId : undefined,
        });
      }
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

      <EvidenceBroadcastUploadHint />

      <form onSubmit={onBulkSubmit} className="space-y-6">
        {mode === "case" ? (
          <CaseUploadDestinationField
            idPrefix="intake-bulk"
            attachToCurrentCase={attachToCurrentCase}
            onAttachChange={setAttachToCurrentCase}
          />
        ) : null}
        {bulkError ? (
          <Alert variant="destructive">
            <AlertDescription>{bulkError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="evidence-intake-multi-files" className="text-foreground">
            Files
          </Label>
          <Input
            id="evidence-intake-multi-files"
            name="files"
            type="file"
            multiple
            className="cursor-pointer border-input bg-form-field text-form-field-foreground file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:text-black"
          />
          <p className="text-xs text-zinc-600">Each file is stored separately with the same source metadata below.</p>
        </div>

        <EvidenceSourceFields idPrefix="intake-bulk" variant="intake" />

        <label className="flex items-start gap-2 cursor-pointer text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-1"
            checked={runExtractionAfterUpload}
            onChange={(ev) => setRunExtractionAfterUpload(ev.target.checked)}
          />
          <span>
            <span className="font-medium text-foreground">Run text extraction immediately after each upload</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              Uncheck to load files first and extract later from each evidence page.
            </span>
          </span>
        </label>

        {bulkRows.length > 0 ? (
          <div
            className={cn(
              "rounded-lg border border-border bg-panel p-3 max-h-48 overflow-y-auto",
              "text-sm text-foreground",
            )}
          >
            <p className="text-xs font-medium text-muted-foreground mb-2">Upload progress</p>
            <ul className="space-y-1.5 text-xs">
              {bulkRows.map((r, i) => (
                <li key={`${r.name}-${i}`} className="flex justify-between gap-2">
                  <span className="truncate text-foreground">{r.name}</span>
                  <span
                    className={
                      r.status === "done" || r.status === "duplicate_info"
                        ? "text-emerald-900 shrink-0 font-medium"
                        : r.status === "error"
                          ? "text-alert-foreground shrink-0 font-medium"
                          : r.status === "uploading"
                            ? "text-amber-900 shrink-0"
                            : "text-muted-foreground shrink-0"
                    }
                  >
                    {r.status === "pending"
                      ? "Queued"
                      : r.status === "uploading"
                        ? "Uploading…"
                        : r.status === "done"
                          ? r.detail ?? "Done"
                          : r.status === "duplicate_info"
                            ? r.detail ?? "Already in library"
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
          className="w-full sm:w-auto border-border bg-card text-foreground hover:bg-muted"
        >
          {bulkLoading ? (
            <InvestigationLoadingIndicator inline label="Processing batch..." />
          ) : runExtractionAfterUpload ? (
            "Upload all & extract"
          ) : (
            "Upload all (extract later)"
          )}
        </Button>
      </form>
    </div>
  );
}

export function EvidenceIntakeUrlForm({ mode, caseId }: IntakeProps) {
  const router = useRouter();
  const [attachToCurrentCase, setAttachToCurrentCase] = useState(true);
  const [runExtractionAfterUpload, setRunExtractionAfterUpload] = useState(true);
  const { apiFromUrl } = useIntakeApi(mode, caseId, attachToCurrentCase);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlInfo, setUrlInfo] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlRows, setUrlRows] = useState<string[]>(["", "", "", "", ""]);
  const [scrubPageUrl, setScrubPageUrl] = useState("");
  const [scrubLoading, setScrubLoading] = useState(false);
  const [scrubError, setScrubError] = useState<string | null>(null);
  const [scrubCandidates, setScrubCandidates] = useState<
    { url: string; label: string; isDirectDocument: boolean; selected: boolean }[]
  >([]);
  const [rowResults, setRowResults] = useState<
    {
      url: string;
      status:
        | "imported"
        | "duplicate_skipped"
        | "extraction_queued"
        | "extraction_complete"
        | "extraction_partial"
        | "extraction_failed";
      id?: string;
      warning?: string;
      error?: string;
      existing?: DuplicateEvidenceMatch;
      needs_extraction?: boolean;
      message?: string;
    }[]
  >([]);

  async function onUrlSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setUrlError(null);
    setUrlInfo(null);
    setRowResults([]);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const urls = urlRows.map((v) => v.trim()).filter(Boolean);
    if (!urls.length) {
      setUrlError("Add at least one link to import.");
      return;
    }
    const source = parseEvidenceSourceFromFormData(fd);
    setUrlLoading(true);
    const res = await fetch(apiFromUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urls,
        source_type: source.source_type,
        source_platform: source.source_platform,
        source_program: source.source_program,
        source_url: source.source_url?.trim() || undefined,
        defer_extraction: !runExtractionAfterUpload,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      results?: {
        url: string;
        id?: string;
        warning?: string;
        duplicate?: boolean;
        existing?: DuplicateEvidenceMatch;
        needs_extraction?: boolean;
        message?: string;
        deferred_extraction?: boolean;
        error?: string;
        import_status:
          | "imported"
          | "duplicate_skipped"
          | "extraction_queued"
          | "extraction_complete"
          | "extraction_partial"
          | "extraction_failed";
      }[];
    };
    setUrlLoading(false);
    if (!res.ok) {
      setUrlError(data.error ?? "Could not import from that address.");
      return;
    }
    const results = data.results ?? [];
    setRowResults(
      results.map((r) => ({
        url: r.url,
        status: r.import_status,
        id: r.id,
        warning: r.warning,
        error: r.error,
        existing: r.existing,
        needs_extraction: r.needs_extraction,
        message: r.message,
      })),
    );
    for (const result of results) {
      if (result.id && isExtractionSoftFailureNotice(result.warning)) {
        const href =
          mode === "case" && caseId && attachToCurrentCase
            ? `/cases/${caseId}/evidence/${result.id}`
            : `/evidence/${result.id}`;
        const label = result.url.length > 72 ? `${result.url.slice(0, 72)}…` : result.url;
        emitExtractionReminder({
          evidenceId: result.id,
          filename: `URL import (${label})`,
          href,
          caseId: mode === "case" && attachToCurrentCase && caseId ? caseId : undefined,
        });
      }
    }
    const importedCount = results.filter((r) => Boolean(r.id)).length;
    const failedCount = results.filter((r) => r.import_status === "extraction_failed" && !r.id).length;
    const duplicateCount = results.filter((r) => r.import_status === "duplicate_skipped").length;
    setUrlInfo(
      `Processed ${results.length} link${results.length === 1 ? "" : "s"}: ${importedCount} imported, ${duplicateCount} duplicate skipped, ${failedCount} failed.`,
    );
    router.refresh();
    window.setTimeout(() => setUrlInfo(null), 10000);
  }

  async function collectPageLinks() {
    setScrubError(null);
    setScrubLoading(true);
    const res = await fetch("/api/evidence/url-link-candidates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_url: scrubPageUrl }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      candidates?: { url: string; label: string; isDirectDocument: boolean }[];
    };
    setScrubLoading(false);
    if (!res.ok) {
      setScrubError(data.error ?? "Could not collect links from that page.");
      return;
    }
    const candidates = data.candidates ?? [];
    setScrubCandidates(
      candidates.map((c) => ({
        ...c,
        selected: c.isDirectDocument,
      })),
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-700">
        Add one or more public <strong className="font-semibold text-foreground">https://</strong> links. Each link is
        imported independently so one failure will not block the rest.
      </p>

      <EvidenceBroadcastUploadHint />

      <form onSubmit={onUrlSubmit} className="space-y-6">
        {mode === "case" ? (
          <CaseUploadDestinationField
            idPrefix="intake-url"
            attachToCurrentCase={attachToCurrentCase}
            onAttachChange={setAttachToCurrentCase}
          />
        ) : null}
        {urlInfo ? (
          <Alert className={urlInfo.includes("extraction was skipped") ? deferredInfoAlertClass : successAlertClass}>
            <AlertDescription
              className={urlInfo.includes("extraction was skipped") ? "text-foreground" : "text-emerald-950"}
            >
              {urlInfo}
            </AlertDescription>
          </Alert>
        ) : null}
        {urlError ? (
          <Alert variant="destructive">
            <AlertDescription>{urlError}</AlertDescription>
          </Alert>
        ) : null}

        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-foreground">Links to import</Label>
            <Button
              type="button"
              variant="secondary"
              className="border-border bg-card text-foreground hover:bg-muted"
              onClick={() => setUrlRows((prev) => [...prev, ""])}
            >
              Add row
            </Button>
          </div>
          <div className="space-y-2">
            {urlRows.map((value, idx) => (
              <Input
                key={`url-row-${idx}`}
                type="url"
                inputMode="url"
                autoComplete="url"
                placeholder="https://example.com/report or direct .pdf link"
                value={value}
                onChange={(ev) =>
                  setUrlRows((prev) => prev.map((row, rowIdx) => (rowIdx === idx ? ev.target.value : row)))
                }
                className="border-input bg-form-field text-form-field-foreground placeholder:text-form-field-placeholder"
              />
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-lg border border-border bg-card p-4">
          <Label htmlFor="source-page-link-collector" className="text-foreground">
            Collect links from a source page
          </Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="source-page-link-collector"
              type="url"
              value={scrubPageUrl}
              onChange={(ev) => setScrubPageUrl(ev.target.value)}
              placeholder="https://example.com/source-page"
              className="border-input bg-form-field text-form-field-foreground placeholder:text-form-field-placeholder"
            />
            <Button
              type="button"
              variant="secondary"
              disabled={scrubLoading}
              className="border-border bg-card text-foreground hover:bg-muted sm:w-auto"
              onClick={collectPageLinks}
            >
              {scrubLoading ? <InvestigationLoadingIndicator inline label="Collecting..." /> : "Collect links"}
            </Button>
          </div>
          {scrubError ? <p className="text-sm text-destructive">{scrubError}</p> : null}
          {scrubCandidates.length ? (
            <div className="space-y-2 rounded-md border border-border bg-background/60 p-3">
              <p className="text-xs text-muted-foreground">
                Select links to add into the batch importer. Direct document links are pre-selected.
              </p>
              <div className="max-h-52 space-y-2 overflow-auto pr-1">
                {scrubCandidates.map((candidate, idx) => (
                  <label key={`${candidate.url}-${idx}`} className="flex items-start gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={candidate.selected}
                      onChange={(ev) =>
                        setScrubCandidates((prev) =>
                          prev.map((row, rowIdx) => (rowIdx === idx ? { ...row, selected: ev.target.checked } : row)),
                        )
                      }
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {candidate.isDirectDocument ? "[Doc] " : ""}
                        {candidate.label}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">{candidate.url}</span>
                    </span>
                  </label>
                ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                className="border-border bg-card text-foreground hover:bg-muted"
                onClick={() => {
                  const selected = scrubCandidates.filter((c) => c.selected).map((c) => c.url);
                  if (!selected.length) return;
                  setUrlRows((prev) => {
                    const existing = new Set(prev.map((v) => v.trim()).filter(Boolean));
                    const deduped = selected.filter((u) => !existing.has(u));
                    return [...prev, ...deduped];
                  });
                }}
              >
                Add selected links to import list
              </Button>
            </div>
          ) : null}
        </div>

        <EvidenceSourceFields idPrefix="intake-url" variant="intake" />

        <label className="flex items-start gap-2 cursor-pointer text-sm text-foreground">
          <input
            type="checkbox"
            className="mt-1"
            checked={runExtractionAfterUpload}
            onChange={(ev) => setRunExtractionAfterUpload(ev.target.checked)}
          />
          <span>
            <span className="font-medium text-foreground">Run text extraction immediately after import</span>
            <span className="block text-xs text-muted-foreground mt-0.5">
              Uncheck to store the imported text file first and extract later from the evidence page.
            </span>
          </span>
        </label>

        <Button
          type="submit"
          disabled={urlLoading}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
          title={undefined}
        >
          {urlLoading ? (
            <InvestigationLoadingIndicator inline label="Importing links..." />
          ) : runExtractionAfterUpload ? (
            "Import links & extract"
          ) : (
            "Import links (extract later)"
          )}
        </Button>

        {rowResults.length ? (
          <div className="space-y-2 rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">Per-link import status</p>
            <div className="space-y-2">
              {rowResults.map((row, idx) => (
                <div key={`${row.url}-${idx}`} className="rounded-md border border-border bg-background/70 p-3 text-sm">
                  <p className="truncate font-medium text-foreground">{row.url}</p>
                  <p className="text-xs text-muted-foreground">
                    {row.status === "imported" && "Imported"}
                    {row.status === "duplicate_skipped" && "Duplicate skipped"}
                    {row.status === "extraction_queued" && "Extraction queued"}
                    {row.status === "extraction_complete" && "Extraction complete"}
                    {row.status === "extraction_partial" && "Extraction partial"}
                    {row.status === "extraction_failed" && "Extraction failed"}
                  </p>
                  {row.warning ? <p className="mt-1 text-xs text-muted-foreground">{row.warning}</p> : null}
                  {row.error ? <p className="mt-1 text-xs text-destructive">{row.error}</p> : null}
                  {row.existing ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button asChild variant="secondary" className="border-border bg-card text-foreground">
                        <Link href={existingEvidenceHref(row.existing)}>Open existing</Link>
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        {row.message ??
                          `Already exists as ${evidencePrimaryLabel({
                            display_filename: row.existing.display_filename,
                            original_filename: row.existing.original_filename,
                          })}.`}
                      </p>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Duplicate override remains disabled to protect collaborative evidence integrity.
            </p>
          </div>
        ) : null}
      </form>
    </div>
  );
}
