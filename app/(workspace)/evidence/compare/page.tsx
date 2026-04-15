import Link from "next/link";
import { EvidenceCompareWorkspace } from "@/components/evidence-compare-workspace";
import { EvidenceCompareSelectorForm } from "@/components/evidence-compare-selector-form";
import { effectiveEvidenceKind, EVIDENCE_KIND_LABEL } from "@/lib/evidence-kind";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";
import { createClient } from "@/lib/supabase/server";
import { listEvidenceVisible } from "@/services/evidence-service";

export default async function EvidenceComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string; e1?: string; e2?: string }>;
}) {
  const { a, b, e1, e2 } = await searchParams;
  const idA = (a ?? e1 ?? "").trim();
  const idB = (b ?? e2 ?? "").trim();

  if (idA && idB) {
    return <EvidenceCompareWorkspace evidenceIdA={idA} evidenceIdB={idB} />;
  }

  const supabase = await createClient();
  const evidenceRows = await listEvidenceVisible(supabase);
  const caseIds = [...new Set(evidenceRows.map((row) => (row.case_id ? String(row.case_id) : null)).filter(Boolean))] as string[];
  const caseTitleById = new Map<string, string>();
  if (caseIds.length > 0) {
    const { data: cases } = await supabase.from("cases").select("id, title").in("id", caseIds);
    for (const c of cases ?? []) {
      const id = String(c.id);
      const title = typeof c.title === "string" ? c.title.trim() : "";
      caseTitleById.set(id, title || id);
    }
  }

  const options = evidenceRows.map((row) => {
    const id = String(row.id);
    const primary = evidencePrimaryLabel({
      display_filename: row.display_filename ?? null,
      original_filename: String(row.original_filename ?? "Untitled evidence"),
    });
    const alias = typeof row.short_alias === "string" ? row.short_alias.trim() : "";
    const kind = EVIDENCE_KIND_LABEL[effectiveEvidenceKind(row)].toUpperCase();
    const caseId = row.case_id ? String(row.case_id) : null;
    const caseLabel = caseId ? caseTitleById.get(caseId) ?? caseId : "Unassigned";
    const parts = [primary];
    if (alias) parts.push(alias);
    parts.push(kind, caseLabel);
    const label = parts.join(" — ");
    return {
      id,
      label,
      searchText: `${label} ${id}`.toLowerCase(),
    };
  });

  return (
    <div
      className="mx-auto min-h-screen max-w-lg space-y-5 p-5 font-sans"
      style={{ backgroundColor: "#0f1623", color: "#e2e8f0" }}
    >
      <div>
        <h1 className="mb-1 text-2xl font-bold text-white">Compare evidence</h1>
        <p className="max-w-xl text-sm leading-relaxed" style={{ color: "#94a3b8" }}>
          Select two evidence files from your{" "}
          <Link href="/evidence" className="font-medium text-sky-400 underline-offset-2 hover:underline">
            evidence library
          </Link>{" "}
          to compare them side by side.
        </p>
      </div>

      <div
        className="rounded-xl border p-4"
        style={{ backgroundColor: "#141e2e", borderColor: "#1e2d42" }}
      >
        <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>
          <span className="font-semibold text-slate-300">Advanced URL</span> — open this route with{" "}
          <code className="mx-0.5 rounded border border-[#263347] bg-[#0f1623] px-1.5 py-0.5 font-mono text-[11px] text-sky-200/90">
            ?a=…&amp;b=…
          </code>{" "}
          or legacy{" "}
          <code className="mx-0.5 rounded border border-[#263347] bg-[#0f1623] px-1.5 py-0.5 font-mono text-[11px] text-sky-200/90">
            ?e1=…&amp;e2=…
          </code>
          .
        </p>
      </div>

      <EvidenceCompareSelectorForm options={options} initialA={idA} initialB={idB} />

      <div
        className="rounded-xl border border-dashed p-4"
        style={{ backgroundColor: "#0f1623", borderColor: "#263347" }}
      >
        <p className="text-xs leading-relaxed" style={{ color: "#64748b" }}>
          <span className="font-semibold text-slate-400">Formats</span> — side-by-side works for images and PDFs; overlay
          is available when both files are images.
        </p>
      </div>
    </div>
  );
}
