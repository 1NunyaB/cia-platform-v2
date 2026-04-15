"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  EVIDENCE_KINDS,
  EVIDENCE_KIND_LABEL,
  type EvidenceKind,
  effectiveEvidenceKind,
} from "@/lib/evidence-kind";
import type { EvidenceFile } from "@/types";

type Row = Pick<
  EvidenceFile,
  "suggested_evidence_kind" | "confirmed_evidence_kind" | "evidence_kind_confirmed_at"
>;

export function EvidenceKindPanel({
  evidenceId,
  row,
  canEdit,
}: {
  evidenceId: string;
  row: Row;
  /** Signed-in owner, case collaborator (server), or guest with session. */
  canEdit: boolean;
}) {
  const router = useRouter();
  const suggested = (row.suggested_evidence_kind as EvidenceKind | null) ?? "document";
  const confirmed = row.confirmed_evidence_kind as EvidenceKind | null;
  const effective = effectiveEvidenceKind(row);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reclassifyOpen, setReclassifyOpen] = useState(false);
  const [pendingKind, setPendingKind] = useState<EvidenceKind>(confirmed ?? suggested);

  async function saveKind(kind: EvidenceKind) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/evidence/${evidenceId}/evidence-kind`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ confirmedKind: kind }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not save type.");
        return;
      }
      setReclassifyOpen(false);
      router.refresh();
    } catch {
      setError("Network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-sky-300/90 bg-sky-50/90 px-3 py-3 text-sm text-foreground shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-foreground">Evidence type</p>
      <p className="mt-1 text-xs leading-relaxed text-foreground/95">
        <strong className="font-semibold">Suggested type:</strong> {EVIDENCE_KIND_LABEL[suggested]} — set automatically
        at upload from MIME type and filename. PDFs are always suggested as{" "}
        <strong className="font-semibold">Document</strong> (they may be text, scans, or mixed); change the type only if
        you deliberately want another category. Evidence <strong className="font-semibold">type</strong> is separate from
        case <strong className="font-semibold">stacks</strong> (e.g. People, Location).
      </p>
      {confirmed ? (
        <p className="mt-2 text-xs">
          <strong className="font-semibold">Confirmed type:</strong> {EVIDENCE_KIND_LABEL[effective]}
        </p>
      ) : (
        <p className="mt-2 text-xs text-foreground/90">Not confirmed yet — review the file, then confirm or reclassify.</p>
      )}

      {canEdit ? (
        <div className="mt-3 flex flex-col gap-2">
          {!confirmed ? (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                className="h-8 bg-sky-800 text-white hover:bg-sky-900"
                disabled={busy}
                onClick={() => void saveKind(suggested)}
              >
                Confirm type
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 border-border"
                disabled={busy}
                onClick={() => {
                  setPendingKind(suggested);
                  setReclassifyOpen((o) => !o);
                }}
              >
                Reclassify
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-8 border-border"
                disabled={busy}
                onClick={() => {
                  setPendingKind(effective);
                  setReclassifyOpen(true);
                }}
              >
                Reclassify
              </Button>
            </div>
          )}

          {reclassifyOpen ? (
            <div className="rounded border border-border bg-white px-2 py-2">
              <p className="mb-2 text-[11px] font-medium text-foreground">Choose a type</p>
              <div className="flex flex-wrap gap-2">
                {EVIDENCE_KINDS.map((k) => (
                  <label
                    key={k}
                    className="flex cursor-pointer items-center gap-1.5 rounded border border-border px-2 py-1 text-xs has-[:checked]:border-sky-600 has-[:checked]:bg-sky-50"
                  >
                    <input
                      type="radio"
                      name={`ev-kind-${evidenceId}`}
                      checked={pendingKind === k}
                      onChange={() => setPendingKind(k)}
                      className="accent-sky-800"
                    />
                    {EVIDENCE_KIND_LABEL[k]}
                  </label>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="h-8"
                  disabled={busy}
                  onClick={() => void saveKind(pendingKind)}
                >
                  Save type
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-8"
                  disabled={busy}
                  onClick={() => setReclassifyOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : null}

          {error ? (
            <p className="text-xs text-red-800" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-[11px] text-muted-foreground">Sign in to confirm or change the type.</p>
      )}
    </div>
  );
}
