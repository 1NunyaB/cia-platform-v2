"use client";

import { useEffect, useState } from "react";
import { DashboardCommandCenter } from "@/components/dashboard-command-center";
import type { DashboardEvidencePreviewRow } from "@/components/dashboard-evidence-preview";

type CaseLite = {
  id: string;
  title: string;
  incident_city?: string | null;
  incident_state?: string | null;
  investigation_started_at?: string | null;
  investigation_on_hold_at?: string | null;
};

export function DashboardMainPanels({
  casesForAssign,
  activeCaseId = null,
  /** When set (including `[]`), skip client fetch — used by case workspace with server-loaded rows. */
  initialEvidenceRows,
}: {
  casesForAssign: CaseLite[];
  activeCaseId?: string | null;
  initialEvidenceRows?: DashboardEvidencePreviewRow[];
}) {
  const serverSupplied = initialEvidenceRows !== undefined;

  const [evidenceRows, setEvidenceRows] = useState<DashboardEvidencePreviewRow[]>(() => initialEvidenceRows ?? []);
  const [evidenceLoading, setEvidenceLoading] = useState(() => !serverSupplied);
  const [evidenceLoadError, setEvidenceLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (serverSupplied) {
      setEvidenceRows(initialEvidenceRows ?? []);
      setEvidenceLoading(false);
      setEvidenceLoadError(null);
      return;
    }

    let cancelled = false;
    const q = new URLSearchParams();
    if (activeCaseId) q.set("caseId", activeCaseId);

    async function load() {
      setEvidenceLoading(true);
      setEvidenceLoadError(null);
      try {
        const res = await fetch(`/api/dashboard/evidence-preview?${q.toString()}`, {
          credentials: "include",
        });
        const data = (await res.json()) as {
          rows?: DashboardEvidencePreviewRow[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setEvidenceRows([]);
          setEvidenceLoadError(data.error ?? "Could not load evidence");
          return;
        }
        setEvidenceRows(data.rows ?? []);
      } catch {
        if (!cancelled) {
          setEvidenceRows([]);
          setEvidenceLoadError("Could not load evidence");
        }
      } finally {
        if (!cancelled) setEvidenceLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [activeCaseId, serverSupplied, initialEvidenceRows]);

  return (
    <div className="space-y-2">
      <DashboardCommandCenter
        evidenceRows={evidenceRows}
        evidenceLoading={evidenceLoading}
        evidenceLoadError={evidenceLoadError}
        casesForAssign={casesForAssign}
        activeCaseId={activeCaseId}
      />
    </div>
  );
}
