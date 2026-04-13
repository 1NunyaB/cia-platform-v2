import { cn } from "@/lib/utils";

/**
 * Visible, high-contrast legend for cross-investigation AI — do not bury verification semantics.
 */
export function CrossCaseLabelLegend({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-lg border border-sky-400/70 bg-sky-50/95 px-3 py-2.5 text-xs text-foreground shadow-sm",
        className,
      )}
      role="region"
      aria-label="How to read verification labels"
    >
      <p className="font-semibold text-foreground mb-1.5">AI label guide (cross-investigation)</p>
      <ul className="space-y-1 leading-snug list-disc pl-4 text-foreground/95">
        <li>
          <span className="font-medium text-foreground">Verified</span> — statement is supported by extracted file text
          shown in this session for that public investigation.
        </li>
        <li>
          <span className="font-medium text-foreground">Unverified</span> — not fully supported by extracts (e.g. weak,
          indirect, or directory-only).
        </li>
        <li>
          <span className="font-medium text-foreground">Confirmed in evidence</span> — directly stated in supplied file
          text.
        </li>
        <li>
          <span className="font-medium text-foreground">Inferred</span> — reasonable synthesis across snippets; not a
          direct quote.
        </li>
        <li>
          <span className="font-medium text-foreground">Uncertain</span> — ambiguous or tentative. Private collaborator
          notes are never included in AI context.
        </li>
      </ul>
    </div>
  );
}
