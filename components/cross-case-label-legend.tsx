import { cn } from "@/lib/utils";

/**
 * Visible, high-contrast legend for cross-investigation AI — do not bury verification semantics.
 */
export function CrossCaseLabelLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-sky-500/35 bg-sky-950/30 px-3 py-2.5 text-xs text-slate-200 shadow-none",
        className,
      )}
      role="region"
      aria-label="How to read verification labels"
    >
      <p className="mb-1.5 font-semibold text-sky-100">AI label guide (cross-investigation)</p>
      <ul className="list-disc space-y-1 pl-4 leading-snug text-slate-400">
        <li>
          <span className="font-medium text-slate-200">Verified</span> — statement is supported by extracted file text
          shown in this session for that public investigation.
        </li>
        <li>
          <span className="font-medium text-slate-200">Unverified</span> — not fully supported by extracts (e.g. weak,
          indirect, or directory-only).
        </li>
        <li>
          <span className="font-medium text-slate-200">Confirmed in evidence</span> — directly stated in supplied file
          text.
        </li>
        <li>
          <span className="font-medium text-slate-200">Inferred</span> — reasonable synthesis across snippets; not a
          direct quote.
        </li>
        <li>
          <span className="font-medium text-slate-200">Uncertain</span> — ambiguous or tentative. Private collaborator
          notes are never included in AI context.
        </li>
      </ul>
    </div>
  );
}
