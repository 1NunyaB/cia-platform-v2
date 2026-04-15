"use client";

import { useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { InvestigationLoadingIndicator } from "@/components/investigation-loading-indicator";
import {
  INVESTIGATION_STACK_KINDS,
  INVESTIGATION_STACK_LABEL,
  type InvestigationStackKind,
} from "@/lib/investigation-stacks";
import { dispatchWorkspaceAiAttachEvidence } from "@/lib/workspace-evidence-ai-bridge";

type Props = {
  variant: "library" | "case";
  /** Required when `variant === "case"`. */
  caseId?: string;
  casesForAssign?: { id: string; title: string }[];
  selectedIds: string[];
  onClearSelection: () => void;
  /** Render as an inline panel (dashboard) instead of sticky footer. */
  inline?: boolean;
};

export function EvidenceBulkActionBar({
  variant,
  caseId,
  casesForAssign = [],
  selectedIds,
  onClearSelection,
  inline = false,
}: Props) {
  const router = useRouter();
  const [assignCaseId, setAssignCaseId] = useState<string>("");
  const [assignBusy, setAssignBusy] = useState(false);
  const [viewedBusy, setViewedBusy] = useState(false);
  const [stackOpen, setStackOpen] = useState(false);
  const [stackTargetCaseId, setStackTargetCaseId] = useState<string>("");
  const [stackKinds, setStackKinds] = useState<Set<InvestigationStackKind>>(() => new Set());
  const [stackBusy, setStackBusy] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);

  const n = selectedIds.length;
  const effectiveCaseId = variant === "case" ? caseId : stackTargetCaseId;

  async function runAssign() {
    if (!assignCaseId) {
      setLastMessage("Choose a case to assign.");
      return;
    }
    setAssignBusy(true);
    setLastMessage(null);
    try {
      const res = await fetch("/api/evidence/bulk/assign-case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidenceIds: selectedIds, caseId: assignCaseId }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        results?: { evidenceId: string; ok: boolean; error?: string }[];
        error?: string;
      };
      if (!res.ok) {
        setLastMessage(data.error ?? "Add to case failed.");
        return;
      }
      const failed = (data.results ?? []).filter((r) => !r.ok).length;
      setLastMessage(
        failed
          ? `Add to case finished with ${failed} error(s). Check permissions and try again for failed rows.`
          : "Added to case.",
      );
      onClearSelection();
      router.refresh();
    } finally {
      setAssignBusy(false);
    }
  }

  async function runMarkViewed() {
    setViewedBusy(true);
    setLastMessage(null);
    try {
      const res = await fetch("/api/evidence/bulk/mark-viewed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ evidenceIds: selectedIds }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        results?: { evidenceId: string; ok: boolean; error?: string }[];
        error?: string;
      };
      if (!res.ok) {
        setLastMessage(data.error ?? "Could not mark viewed.");
        return;
      }
      const failed = (data.results ?? []).filter((r) => !r.ok).length;
      setLastMessage(failed ? `Marked with ${failed} error(s).` : "Marked as viewed.");
      onClearSelection();
      router.refresh();
    } finally {
      setViewedBusy(false);
    }
  }

  async function runAddStacks() {
    if (!effectiveCaseId) {
      setLastMessage("Choose a case for stacks.");
      return;
    }
    if (stackKinds.size === 0) {
      setLastMessage("Select at least one stack.");
      return;
    }
    setStackBusy(true);
    setLastMessage(null);
    try {
      const res = await fetch(`/api/cases/${effectiveCaseId}/evidence/bulk-stacks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          evidenceIds: selectedIds,
          stackKinds: [...stackKinds],
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        results?: { ok: boolean }[];
        error?: string;
      };
      if (!res.ok) {
        setLastMessage(data.error ?? "Stacks update failed.");
        return;
      }
      const failed = (data.results ?? []).filter((r) => !r.ok).length;
      setLastMessage(
        failed
          ? `Stacks updated with ${failed} row error(s) (duplicates are skipped).`
          : "Added to selected stacks (duplicates skipped).",
      );
      setStackOpen(false);
      onClearSelection();
      router.refresh();
    } finally {
      setStackBusy(false);
    }
  }

  function openStacksDialog() {
    setLastMessage(null);
    if (variant === "case" && caseId) {
      setStackTargetCaseId(caseId);
    } else {
      setStackTargetCaseId(assignCaseId || casesForAssign[0]?.id || "");
    }
    setStackOpen(true);
  }

  function toggleStackKind(k: InvestigationStackKind) {
    setStackKinds((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  if (n === 0) return null;

  return (
    <>
      <div
        className={
          inline
            ? "flex flex-col gap-2 rounded-lg border border-sky-400 bg-sky-50/80 p-2.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
            : "sticky bottom-4 z-40 flex flex-col gap-2 rounded-lg border-2 border-sky-500 bg-sky-50/95 p-3 shadow-lg sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
        }
      >
        <p className="text-sm font-semibold text-sky-950">
          {n} selected
          {lastMessage ? (
            <span className="ml-2 font-normal text-foreground/90">— {lastMessage}</span>
          ) : null}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {variant === "library" && casesForAssign.length > 0 ? (
            <>
              <Select value={assignCaseId} onValueChange={setAssignCaseId}>
                <SelectTrigger className="h-9 w-[min(220px,100%)] border-sky-400 bg-white text-xs">
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
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-9 border-sky-600 bg-white"
                disabled={assignBusy || !assignCaseId}
                onClick={() => void runAssign()}
              >
                {assignBusy ? <InvestigationLoadingIndicator inline label="Adding…" /> : "Add to case"}
              </Button>
            </>
          ) : null}

          <Button type="button" size="sm" variant="secondary" className="h-9 border-sky-600 bg-white" onClick={openStacksDialog}>
            Add to evidence stack(s)…
          </Button>

          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="h-9 border-sky-700 bg-sky-100 font-semibold text-sky-950 hover:bg-sky-200"
            onClick={() => {
              setLastMessage(null);
              dispatchWorkspaceAiAttachEvidence({
                evidenceIds: selectedIds,
                caseId: variant === "case" ? caseId ?? null : null,
              });
              setLastMessage("Selection sent to the AI assistant panel.");
            }}
          >
            Send to AI
          </Button>

          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-9"
            disabled={viewedBusy}
            onClick={() => void runMarkViewed()}
          >
            {viewedBusy ? <InvestigationLoadingIndicator inline label="Saving…" /> : "Mark viewed"}
          </Button>

          <Button type="button" size="sm" variant="outline" className="h-9" onClick={onClearSelection}>
            Clear selection
          </Button>
        </div>
      </div>

      <Dialog open={stackOpen} onOpenChange={setStackOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to evidence stack(s)</DialogTitle>
            <DialogDescription>
              Choose stacks (Location, People, …). Evidence must already be on the case; duplicates are ignored.
            </DialogDescription>
          </DialogHeader>

          {variant === "library" ? (
            <div className="space-y-2">
              <Label className="text-foreground">Case</Label>
              <Select value={stackTargetCaseId} onValueChange={setStackTargetCaseId}>
                <SelectTrigger>
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
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Case: this workspace.</p>
          )}

          <div className="space-y-2 pt-2">
            <Label className="text-foreground">Stacks</Label>
            <div className="grid gap-2">
              {INVESTIGATION_STACK_KINDS.map((k) => (
                <label key={k} className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-input"
                    checked={stackKinds.has(k)}
                    onChange={() => toggleStackKind(k)}
                  />
                  {INVESTIGATION_STACK_LABEL[k]}
                </label>
              ))}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setStackOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={stackBusy || !effectiveCaseId || stackKinds.size === 0}
              onClick={() => void runAddStacks()}
            >
              {stackBusy ? <InvestigationLoadingIndicator inline label="Applying…" /> : "Add to evidence stack(s)"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
