"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { SHARE_RELEVANCE_STRONG_MIN } from "@/lib/evidence-share-relevance-constants";

type Candidate = {
  caseId: string;
  title: string;
  score: number;
  signals: string[];
  strong: boolean;
};

export function ShareEvidenceToCaseDialog({
  evidenceId,
  excludeCaseId,
}: {
  evidenceId: string;
  excludeCaseId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [candidates, setCandidates] = React.useState<Candidate[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [selectedId, setSelectedId] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [weakAck, setWeakAck] = React.useState(false);

  const selected = candidates.find((c) => c.caseId === selectedId);

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    setWeakAck(false);
    setSelectedId("");
    setSubmitError(null);
    (async () => {
      try {
        const res = await fetch(
          `/api/evidence/${evidenceId}/share-candidates?excludeCaseId=${encodeURIComponent(excludeCaseId)}`,
        );
        const data = (await res.json().catch(() => ({}))) as {
          candidates?: Candidate[];
          error?: string;
        };
        if (!res.ok) {
          if (!cancelled) setLoadError(data.error ?? "Could not load investigations.");
          return;
        }
        if (!cancelled) setCandidates(data.candidates ?? []);
      } catch {
        if (!cancelled) setLoadError("Could not load investigations.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, evidenceId, excludeCaseId]);

  React.useEffect(() => {
    setWeakAck(false);
    setSubmitError(null);
  }, [selectedId]);

  async function submit() {
    if (!selectedId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const confirmWeakLink = !!(selected && !selected.strong && weakAck);
      const res = await fetch(`/api/evidence/${evidenceId}/link-investigation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          caseId: selectedId,
          confirmWeakLink,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        message?: string;
        score?: number;
      };
      if (res.status === 409 && data.error === "weak_relevance") {
        setSubmitError(data.message ?? "No strong relevance was found. Confirm to continue.");
        return;
      }
      if (!res.ok) {
        setSubmitError(data.error ?? "Could not link file.");
        return;
      }
      setOpen(false);
      router.push(`/cases/${selectedId}/evidence/${evidenceId}`);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const needsWeakCheckbox = Boolean(selected && !selected.strong);
  const canSubmit = Boolean(selectedId && (!needsWeakCheckbox || weakAck));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="secondary" size="sm">
          Share to another investigation
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Link file to another investigation</DialogTitle>
          <DialogDescription className="text-foreground">
            The same stored file is linked inside the app only (no public or export link). Other investigators see it only
            if they can open that investigation.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="text-sm text-foreground">Loading your investigations…</p>
        ) : loadError ? (
          <Alert variant="destructive">
            <AlertDescription>{loadError}</AlertDescription>
          </Alert>
        ) : candidates.length === 0 ? (
          <p className="text-sm text-foreground">
            You have no other investigations to link to, or this file is already linked everywhere it can be.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-foreground" htmlFor="share-case-select">
                Target investigation
              </label>
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger id="share-case-select">
                  <SelectValue placeholder="Choose an investigation…" />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.caseId} value={c.caseId}>
                      {c.title}
                      {c.strong ? " · Relevant match" : c.score > 0 ? " · Possible match" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selected ? (
              <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs text-foreground">
                <p className="font-medium">Relevance score: {selected.score}</p>
                <p className="mt-0.5 text-muted-foreground">
                  Strong match threshold is {SHARE_RELEVANCE_STRONG_MIN}. Higher scores list overlapping titles, entities,
                  aliases, years, clusters, or sources.
                </p>
                {selected.signals.length > 0 ? (
                  <ul className="mt-2 list-inside list-disc space-y-0.5 text-foreground">
                    {selected.signals.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-muted-foreground">No overlapping signals detected from available metadata.</p>
                )}
              </div>
            ) : null}

            {needsWeakCheckbox ? (
              <label className="flex cursor-pointer items-start gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-input"
                  checked={weakAck}
                  onChange={(e) => setWeakAck(e.target.checked)}
                />
                <span>
                  No strong relevance was found. Continue linking anyway — I confirm this file should appear in the
                  selected investigation.
                </span>
              </label>
            ) : null}

            {submitError ? (
              <Alert variant="destructive">
                <AlertDescription>{submitError}</AlertDescription>
              </Alert>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          {!loading && !loadError && candidates.length > 0 ? (
            <Button type="button" disabled={!canSubmit || submitting} onClick={() => void submit()}>
              {submitting ? "Linking…" : "Link to investigation"}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
