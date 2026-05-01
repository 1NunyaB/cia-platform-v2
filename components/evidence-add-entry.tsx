"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cisCasePage } from "@/lib/cis-case-page-shell";
import { cn } from "@/lib/utils";
import { FilePlus } from "lucide-react";

/**
 * Compact entry point to the two-step evidence intake flow (launcher → type-specific screen).
 */
export function EvidenceAddEntry({
  caseId,
  mode = "case",
}: {
  caseId?: string;
  /** `library` — uploads to the user evidence pool without a case. */
  mode?: "case" | "library";
}) {
  if (mode === "case" && !caseId) {
    throw new Error("EvidenceAddEntry requires caseId when mode is case.");
  }
  const href = mode === "library" ? "/evidence/add" : `/cases/${caseId}/evidence/add`;

  return (
    <div className={cn("rounded-xl border border-[#1e2d42] bg-[#141e2e] p-5 text-slate-200 shadow-none")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-white">Add evidence</h3>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            {mode === "library"
              ? "Open the intake flow to upload or import into your library. Add files to a case later."
              : "Upload files or import from a URL on dedicated screens — less clutter, same validation and storage."}
          </p>
        </div>
        <Button
          asChild
          className="shrink-0 border border-blue-600 bg-[#1e40af] text-white shadow-none hover:bg-blue-600"
        >
          <Link href={href}>
            <FilePlus className="mr-2 h-4 w-4" aria-hidden />
            Add evidence
          </Link>
        </Button>
      </div>
    </div>
  );
}
