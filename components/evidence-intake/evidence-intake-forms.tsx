"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Circle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { EvidenceSourceFields } from "@/components/evidence-source-fields";
import { parseEvidenceSourceFromFormData } from "@/lib/evidence-source";
import type { DuplicateEvidenceMatch } from "@/lib/evidence-upload-errors";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";
import { InvestigationLoadingIndicator } from "@/components/investigation-loading-indicator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

type BulkUploadPhase = "pending" | "uploading" | "done" | "error" | "duplicate_info";

type BulkBatchRow = {
  key: string;
  name: string;
  uploadPhase: BulkUploadPhase;
  uploadDetail?: string;
  evidenceId?: string;
  selected: boolean;
};

function evidenceDetailHref(
  mode: "case" | "library",
  caseId: string | undefined,
  attachToCurrentCase: boolean,
  evidenceId: string,
) {
  if (mode === "case" && caseId && attachToCurrentCase) {
    return `/cases/${caseId}/evidence/${evidenceId}`;
  }
  return `/evidence/${evidenceId}`;
}

const securityNoticeClass =
  "rounded-lg border border-alert-border bg-alert px-4 py-3 text-sm text-alert-foreground leading-relaxed";

/** Informational duplicate: not a failure — no new row was created. */
const duplicateInfoAlertClass =
  "border-emerald-200 bg-emerald-50 text-emerald-950 [&_a]:text-blue-900 [&_a]:underline [&_button]:text-foreground";

const successAlertClass = "border-emerald-200 bg-emerald-50 text-emerald-950";

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
  casesForAssign?: { id: string; title: string }[];
};

export function EvidenceIntakeSingleForm({ mode, caseId }: IntakeProps) {
  const router = useRouter();
  const [attachToCurrentCase, setAttachToCurrentCase] = useState(true);
  const { apiEvidence } = useIntakeApi(mode, caseId, attachToCurrentCase);
  const [singleError, setSingleError] = useState<string | null>(null);
  const [singleLoading, setSingleLoading] = useState(false);
  const [dupInfo, setDupInfo] = useState<{
    existing: DuplicateEvidenceMatch;
    message?: string;
  } | null>(null);

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
    const fd = new FormData(form);
    const res = await fetch(apiEvidence, {
      method: "POST",
      body: fd,
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      warning?: string;
      duplicate?: boolean;
      existing?: DuplicateEvidenceMatch;
      message?: string;
      no_new_record?: boolean;
      id?: string;
    };
    setSingleLoading(false);
    const existing = data.existing;
    const isDup = Boolean(data.duplicate && existing && (res.ok || res.status === 409));
    if (isDup && existing) {
      setDupInfo({
        existing,
        message: data.message,
      });
      return;
    }
    if (!res.ok) {
      setSingleError(data.error ?? "Upload failed");
      return;
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

        <p className="rounded-lg border border-border bg-card px-3 py-2 text-xs leading-relaxed text-foreground">
          Files are stored for in-app viewing (preview, zoom, crop). After upload, open the evidence page to review,
          crop, or run AI analysis.
        </p>

        <Button
          type="submit"
          disabled={singleLoading}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
          title={undefined}
        >
          {singleLoading ? (
            <InvestigationLoadingIndicator inline label="Scanning upload..." />
          ) : (
            "Upload"
          )}
        </Button>
      </form>
    </div>
  );
}

export function EvidenceIntakeBulkForm({ mode, caseId }: IntakeProps) {
  const router = useRouter();
  const [attachToCurrentCase, setAttachToCurrentCase] = useState(true);
  const { apiEvidence } = useIntakeApi(mode, caseId, attachToCurrentCase);
  const [bulkRows, setBulkRows] = useState<BulkBatchRow[]>([]);
  const bulkRowsRef = useRef<BulkBatchRow[]>([]);
  bulkRowsRef.current = bulkRows;
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  function clearBatchList() {
    setBulkRows([]);
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
    const batchId = `b-${Date.now()}`;
    setBulkRows(
      arr.map((f, i) => ({
        key: `${batchId}-${i}`,
        name: f.name,
        uploadPhase: "pending",
        selected: false,
      })),
    );
    setBulkLoading(true);

    const sourcePayload = parseEvidenceSourceFromFormData(new FormData(form));

    for (let i = 0; i < arr.length; i++) {
      const rowKey = `${batchId}-${i}`;
      setBulkRows((prev) =>
        prev.map((r) => (r.key === rowKey ? { ...r, uploadPhase: "uploading", uploadDetail: "Validating & scanning…" } : r)),
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
        message?: string;
      };
      const existing = data.existing;
      const isDup = Boolean(data.duplicate && existing && (res.ok || res.status === 409));
      if (isDup && existing) {
        const label = evidencePrimaryLabel({
          display_filename: existing.display_filename,
          original_filename: existing.original_filename,
        });
        setBulkRows((prev) =>
          prev.map((r) =>
            r.key === rowKey
              ? {
                  ...r,
                  uploadPhase: "duplicate_info",
                  uploadDetail:
                    data.message ??
                    `Already stored as “${label}” — no new row. Open that item to review.`,
                  evidenceId: undefined,
                  selected: false,
                }
              : r,
          ),
        );
        continue;
      }
      if (!res.ok) {
        setBulkRows((prev) =>
          prev.map((r) =>
            r.key === rowKey
              ? {
                  ...r,
                  uploadPhase: "error",
                  uploadDetail: data.error ?? "Blocked or rejected",
                  selected: false,
                }
              : r,
          ),
        );
        continue;
      }

      if (!data.id) {
        setBulkRows((prev) =>
          prev.map((r) =>
            r.key === rowKey
              ? {
                  ...r,
                  uploadPhase: "done",
                  uploadDetail: "Upload accepted but no evidence id was returned — refresh and check your library.",
                  selected: true,
                }
              : r,
          ),
        );
        continue;
      }

      setBulkRows((prev) =>
        prev.map((r) =>
          r.key === rowKey
            ? {
                ...r,
                evidenceId: data.id,
                uploadPhase: "done",
                uploadDetail: data.warning ? String(data.warning) : undefined,
                selected: false,
              }
            : r,
        ),
      );
    }

    setBulkLoading(false);
    form.reset();
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <p className={securityNoticeClass}>
        <strong className="font-semibold">Security:</strong> each file is validated and scanned. Blocked files are
        not stored. Allowed types include PDF, text, Office, images, and common audio/video — not executables or
        archives.
      </p>

      <EvidenceBroadcastUploadHint />

      <form onSubmit={onBulkSubmit} className="space-y-4">
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
          <p className="text-xs text-muted-foreground">Each file is stored separately with the same source metadata below.</p>
        </div>

        <EvidenceSourceFields idPrefix="intake-bulk" variant="intake" />

        <p className="rounded-lg border border-border bg-card px-3 py-2 text-xs leading-relaxed text-foreground">
          Each file uploads in sequence. When a row shows “Uploaded successfully,” open it to preview, zoom, crop, or
          run AI analysis from the evidence page.
        </p>

        <Button
          type="submit"
          disabled={bulkLoading}
          variant="secondary"
          className="w-full sm:w-auto border-border bg-card text-foreground hover:bg-muted"
        >
          {bulkLoading ? (
            <InvestigationLoadingIndicator inline label="Processing batch..." />
          ) : (
            "Upload all"
          )}
        </Button>
      </form>

      {bulkRows.length > 0 ? (
        <div className="rounded-lg border-2 border-border bg-panel p-3 space-y-3">
          <p className="rounded-md border border-sky-300/80 bg-sky-50 px-2.5 py-1.5 text-[11px] leading-snug text-sky-950">
            <strong className="font-semibold">Batch status:</strong> each successful row links to the stored file — open
            it for embedded preview, zoom, and crop.
          </p>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground">Uploaded files</p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="h-7 text-xs" onClick={clearBatchList}>
                Clear list
              </Button>
            </div>
          </div>

          <div className="max-h-[min(55vh,420px)] overflow-x-auto overflow-y-auto">
            <table className="w-full min-w-[480px] border-collapse text-xs text-foreground">
              <thead>
                <tr className="border-b border-border text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="py-1.5 pr-2" scope="col">
                    File
                  </th>
                  <th className="py-1.5 pr-2 w-[180px]" scope="col">
                    Upload
                  </th>
                  <th className="py-1.5 w-[120px]" scope="col">
                    Open
                  </th>
                </tr>
              </thead>
              <tbody>
                {bulkRows.map((r) => {
                  return (
                    <tr key={r.key} className="border-b border-border/80 align-top">
                      <td className="py-2 pr-2 font-medium break-all">{r.name}</td>
                      <td className="py-2 pr-2">
                        {r.uploadPhase === "pending" ? (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <Circle className="h-3.5 w-3.5" aria-hidden />
                            Queued
                          </span>
                        ) : r.uploadPhase === "uploading" ? (
                          <span className="inline-flex items-center gap-1 text-amber-900 font-medium">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                            Uploading…
                          </span>
                        ) : r.uploadPhase === "done" ? (
                          <span className="inline-flex items-start gap-1 text-emerald-950 font-semibold">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
                            <span>
                              Uploaded successfully
                              {r.uploadDetail ? (
                                <span className="mt-0.5 block font-normal text-[10px] text-foreground/90">{r.uploadDetail}</span>
                              ) : null}
                            </span>
                          </span>
                        ) : r.uploadPhase === "duplicate_info" ? (
                          <span className="inline-flex items-start gap-1 text-emerald-900">
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 mt-0.5" aria-hidden />
                            <span className="font-medium">{r.uploadDetail ?? "Duplicate — not uploaded again"}</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-destructive font-semibold">
                            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
                            Failed
                            {r.uploadDetail ? <span className="block font-normal text-[10px]">{r.uploadDetail}</span> : null}
                          </span>
                        )}
                      </td>
                      <td className="py-2">
                        {r.evidenceId ? (
                          <Button asChild variant="secondary" size="sm" className="h-7 px-2 text-[11px] border-border">
                            <Link href={evidenceDetailHref(mode, caseId, attachToCurrentCase, r.evidenceId)}>Open</Link>
                          </Button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function EvidenceIntakeUrlForm({ mode, caseId, casesForAssign = [] }: IntakeProps) {
  const router = useRouter();
  const [attachToCurrentCase, setAttachToCurrentCase] = useState(true);
  const { apiFromUrl } = useIntakeApi(mode, caseId, attachToCurrentCase);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [urlInfo, setUrlInfo] = useState<string | null>(null);
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlRows, setUrlRows] = useState<string[]>(["", "", "", "", ""]);
  const [selectedCaseId, setSelectedCaseId] = useState<string>(casesForAssign[0]?.id ?? "");
  const [scrubPageUrl, setScrubPageUrl] = useState("");
  const [scrubLoading, setScrubLoading] = useState(false);
  const [scrubError, setScrubError] = useState<string | null>(null);
  const [scrubCandidates, setScrubCandidates] = useState<
    { url: string; label: string; isDirectDocument: boolean; selected: boolean }[]
  >([]);
  const [rowResults, setRowResults] = useState<
    {
      url: string;
      status: "imported" | "duplicate_skipped" | "failed";
      id?: string;
      warning?: string;
      error?: string;
      existing?: DuplicateEvidenceMatch;
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
    if (mode === "library" && !selectedCaseId) {
      setUrlError("Import failed — no case selected. Please select or create a case before importing.");
      return;
    }
    const source = parseEvidenceSourceFromFormData(fd);
    setUrlLoading(true);
    const res = await fetch(apiFromUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        urls,
        ...(mode === "library" ? { case_id: selectedCaseId } : {}),
        source_type: source.source_type,
        source_platform: source.source_platform,
        source_program: source.source_program,
        source_url: source.source_url?.trim() || undefined,
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
        message?: string;
        error?: string;
        import_status: "imported" | "duplicate_skipped" | "failed";
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
        existing: r.existing as DuplicateEvidenceMatch | undefined,
        message: r.message,
      })),
    );
    const importedCount = results.filter((r) => r.import_status === "imported").length;
    const failedCount = results.filter((r) => r.import_status === "failed").length;
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
        Add one or more public links (e.g. <strong className="font-semibold text-foreground">wikipedia.org/page</strong>{" "}
        or full URLs). If protocol is missing, <strong className="font-semibold text-foreground">https://</strong> is
        applied automatically. Each link is imported independently so one failure will not block the rest.
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
        {mode === "library" ? (
          <div className="space-y-2 rounded-lg border border-border bg-card p-4">
            <Label className="text-foreground">Import into case</Label>
            <Select value={selectedCaseId} onValueChange={setSelectedCaseId}>
              <SelectTrigger className="border-input bg-form-field text-form-field-foreground">
                <SelectValue placeholder="Select case…" />
              </SelectTrigger>
              <SelectContent>
                {casesForAssign.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Evidence will be imported into this case so activity logging and case context stay consistent.
            </p>
          </div>
        ) : null}
        {urlInfo ? (
          <Alert className={successAlertClass}>
            <AlertDescription className="text-emerald-950">{urlInfo}</AlertDescription>
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
                type="text"
                inputMode="url"
                autoComplete="url"
                placeholder="example.com/report or https://example.com/report"
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
              type="text"
              value={scrubPageUrl}
              onChange={(ev) => setScrubPageUrl(ev.target.value)}
              placeholder="example.com/source-page"
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

        <p className="rounded-lg border border-border bg-card px-3 py-2 text-xs leading-relaxed text-foreground">
          Each URL is fetched and stored as evidence text for in-app viewing. Open the evidence page to preview, zoom,
          crop, or run AI analysis.
        </p>

        <Button
          type="submit"
          disabled={urlLoading}
          className="w-full bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto"
          title={undefined}
        >
          {urlLoading ? <InvestigationLoadingIndicator inline label="Importing links..." /> : "Import links"}
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
                    {row.status === "failed" && "Import failed"}
                  </p>
                  {row.warning ? <p className="mt-1 text-xs text-muted-foreground">{row.warning}</p> : null}
                  {row.error ? <p className="mt-1 text-xs text-destructive">{row.error}</p> : null}
                  {row.status === "imported" && row.id ? (
                    <div className="mt-2">
                      <Button asChild variant="secondary" size="sm" className="h-7 border-border bg-card text-foreground">
                        <Link href={evidenceDetailHref(mode, caseId, attachToCurrentCase, row.id)}>Open evidence</Link>
                      </Button>
                    </div>
                  ) : null}
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
