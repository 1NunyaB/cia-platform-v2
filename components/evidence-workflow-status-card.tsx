"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2, FolderPlus, Link2, Loader2, Sparkles, XCircle } from "lucide-react";
import { dispatchWorkspaceAiAttachEvidence } from "@/lib/workspace-evidence-ai-bridge";
import type { EvidenceProcessingStatus } from "@/types";
import { Button } from "@/components/ui/button";

function CompactLine({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex gap-2 text-[11px] leading-snug text-foreground">
      <span className="mt-0.5 shrink-0 text-foreground" aria-hidden>
        {icon}
      </span>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * Primary workflow: upload → view → zoom → crop/edit → analyze. No extraction step in the UI.
 */
export function EvidenceWorkflowStatusCard({
  processingStatus,
  evidenceId,
  uploadHref,
  assignControl,
  linkedCasesControl,
  deleteControl,
  processingErrorMessage = null,
  evidenceDisplayLabel = null,
  caseIdForWorkspaceAi = null,
}: {
  processingStatus: EvidenceProcessingStatus;
  evidenceId: string;
  uploadHref: string;
  assignControl?: ReactNode;
  /** Multi-case checklist (library + case detail). */
  linkedCasesControl?: ReactNode;
  deleteControl?: ReactNode;
  processingErrorMessage?: string | null;
  evidenceDisplayLabel?: string | null;
  caseIdForWorkspaceAi?: string | null;
}) {
  const uploadBlocked = processingStatus === "blocked";
  const uploadInFlight = processingStatus === "pending" || processingStatus === "scanning";
  const uploadReady =
    !uploadBlocked &&
    !uploadInFlight &&
    (processingStatus === "accepted" ||
      processingStatus === "extracting" ||
      processingStatus === "analyzing" ||
      processingStatus === "complete" ||
      processingStatus === "error");

  const processingErrored = processingStatus === "error";

  return (
    <div className="space-y-2 text-xs text-foreground">
      <div className="space-y-1.5 rounded-md border border-sky-200/90 bg-sky-50/90 px-2.5 py-2">
        <CompactLine
          icon={
            uploadBlocked ? (
              <XCircle className="h-4 w-4 text-red-900" />
            ) : uploadInFlight ? (
              <Loader2 className="h-4 w-4 animate-spin text-sky-800" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-800" />
            )
          }
        >
          <span className="font-semibold">File uploaded successfully</span>
          <span className="text-foreground/95">
            {" "}
            —{" "}
            {uploadBlocked ? "not stored" : uploadInFlight ? "finishing security scan" : "stored"}
          </span>
        </CompactLine>

        <CompactLine icon={<FolderPlus className="h-4 w-4 text-sky-900" />}>
          <span className="font-semibold">Add to case</span>
          <span className="block text-foreground/95">{assignControl ?? "—"}</span>
        </CompactLine>

        {linkedCasesControl ? (
          <CompactLine icon={<Link2 className="h-4 w-4 text-sky-900" />}>
            <span className="font-semibold">Linked cases</span>
            <span className="block text-foreground/95">{linkedCasesControl}</span>
          </CompactLine>
        ) : null}

        <CompactLine icon={<Sparkles className="h-4 w-4 text-indigo-800" />}>
          <span className="font-semibold">Add to evidence stack(s)</span>
          <span className="block text-[10px] text-foreground/90">
            On the case workspace, add this file to investigation stacks (separate from Evidence type above).
          </span>
        </CompactLine>
      </div>

      {processingErrored && processingErrorMessage?.trim() ? (
        <p className="rounded border border-red-300 bg-red-50 px-2 py-1.5 text-[11px] font-medium text-red-950">
          {processingErrorMessage.trim()}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        <Button
          asChild
          variant="secondary"
          size="sm"
          className="h-8 border-border bg-card px-3 text-xs font-semibold text-foreground"
        >
          <Link href={uploadHref}>Upload</Link>
        </Button>
        <Button
          asChild
          variant="secondary"
          size="sm"
          className="h-8 border-sky-500 bg-white px-3 text-xs font-semibold text-foreground hover:bg-sky-50"
        >
          <a href="#evidence-file-preview">Open file view</a>
        </Button>
        <Button asChild variant="outline" size="sm" className="h-8 border-sky-400 bg-sky-50 text-xs font-semibold">
          <Link href={`/evidence/compare?a=${encodeURIComponent(evidenceId)}`}>Compare</Link>
        </Button>
        {uploadReady && !uploadBlocked && evidenceDisplayLabel ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="h-8 gap-1 border-sky-600 bg-sky-100 px-2 text-xs font-semibold text-sky-950 hover:bg-sky-200/80"
            onClick={() =>
              dispatchWorkspaceAiAttachEvidence({
                evidenceId,
                caseId: caseIdForWorkspaceAi,
                label: evidenceDisplayLabel,
              })
            }
          >
            <Sparkles className="size-3.5 shrink-0" aria-hidden />
            Send to AI
          </Button>
        ) : null}
        {deleteControl ? <div className="ml-auto flex items-center">{deleteControl}</div> : null}
      </div>
    </div>
  );
}
