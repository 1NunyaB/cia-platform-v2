"use client";

import Link from "next/link";
import { useState } from "react";
import type { EvidenceProcessingStatus } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EvidenceStatusBullets } from "@/components/evidence-status-bullets";
import { resolveEvidenceStatusBullets } from "@/lib/evidence-status-bullets";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";
import { EVIDENCE_SOURCE_TYPE_LABELS, type EvidenceSourceType } from "@/lib/evidence-source";

export type DashboardEvidencePreviewRow = {
  id: string;
  original_filename: string;
  display_filename?: string | null;
  short_alias?: string | null;
  created_at: string;
  case_id: string | null;
  source_type?: string | null;
  source_platform?: string | null;
  source_program?: string | null;
  processing_status: EvidenceProcessingStatus;
  extraction_status?: string | null;
  case_membership_count: number;
  has_ai_analysis: boolean;
  viewed: boolean;
  has_content_duplicate_peer: boolean;
};

export function DashboardEvidencePreview({ rows }: { rows: DashboardEvidencePreviewRow[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  function toggleSelected(id: string, checked: boolean) {
    setSelected((prev) => {
      if (checked) {
        if (prev.includes(id)) return prev;
        if (prev.length < 2) return [...prev, id];
        return [prev[1]!, id];
      }
      return prev.filter((x) => x !== id);
    });
  }

  const compareHref =
    selected.length === 2
      ? `/evidence/compare?a=${encodeURIComponent(selected[0]!)}&b=${encodeURIComponent(selected[1]!)}`
      : null;

  return (
    <Card className="border-border bg-card shadow-sm min-h-[44vh]">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-foreground">Evidence quick view</CardTitle>
        <CardDescription className="text-xs text-muted-foreground">
          Open evidence directly here or select up to two files for side-by-side comparison.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 h-[calc(44vh-68px)] min-h-[260px]">
        {rows.length === 0 ? (
          <div className="rounded-md border border-border bg-panel px-3 py-4 text-sm text-foreground">
            <p className="text-muted-foreground">No evidence yet</p>
          </div>
        ) : (
          <ul className="divide-y divide-border rounded-md border border-border bg-panel h-full overflow-y-auto">
            {rows.map((r) => {
              const href = r.case_id
                ? `/cases/${r.case_id}/evidence/${r.id}`
                : `/evidence/${r.id}`;
              const primary = evidencePrimaryLabel({
                display_filename: r.display_filename ?? null,
                original_filename: r.original_filename,
              });
              const bullets = resolveEvidenceStatusBullets({
                caseId: r.case_id,
                caseMembershipCount: r.case_membership_count,
                processingStatus: r.processing_status,
                hasAiAnalysis: r.has_ai_analysis,
                viewed: r.viewed,
                hasContentDuplicatePeer: r.has_content_duplicate_peer,
              });
              const sourceLabel =
                (r.source_program && String(r.source_program).trim()) ||
                (r.source_platform && String(r.source_platform).trim()) ||
                EVIDENCE_SOURCE_TYPE_LABELS[(r.source_type as EvidenceSourceType) ?? "unknown"] ||
                "";
              const checked = selected.includes(r.id);
              return (
                <li key={r.id} className="px-3 py-2.5 hover:bg-muted/50">
                  <div className="flex items-start gap-2">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={checked}
                      onChange={(e) => toggleSelected(r.id, e.target.checked)}
                      aria-label={`Select ${primary} for compare`}
                    />
                    <span className="mt-1">
                      <EvidenceStatusBullets kinds={bullets} />
                    </span>
                    <Link href={href} className="block min-w-0 flex-1">
                      <span className="text-sm font-medium text-foreground truncate block">{primary}</span>
                      <span className="text-[10px] text-muted-foreground truncate block">
                        {sourceLabel || "Source not labeled"}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {r.case_id || r.case_membership_count > 0 ? "Current case evidence" : "Evidence Library"} ·{" "}
                        {new Date(r.created_at).toLocaleString()}
                      </span>
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {compareHref ? (
          <div className="pt-1">
            <Button asChild size="sm" className="bg-primary text-primary-foreground">
              <Link href={compareHref}>Compare selected</Link>
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
