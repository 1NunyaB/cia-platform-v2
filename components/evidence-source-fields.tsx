"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  EVIDENCE_SOURCE_TYPES,
  EVIDENCE_SOURCE_TYPE_LABELS,
  type EvidenceSourceType,
} from "@/lib/evidence-source";

/**
 * Shared field names for `parseEvidenceSourceFromFormData` — include inside each upload/import form.
 */
export function EvidenceSourceFields({
  idPrefix,
  defaultUrl,
}: {
  idPrefix: string;
  /** Prefill URL (e.g. import-from-link). */
  defaultUrl?: string;
}) {
  return (
    <div className="rounded-md border border-zinc-700/80 bg-zinc-900/40 p-3 space-y-3">
      <div>
        <p className="text-xs font-medium text-foreground">Source (recommended)</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Helps the case index, filters, and audits. Choose the closest type — use{" "}
          <span className="text-zinc-300">Unknown</span> only when it truly cannot be determined.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-source-type`} className="text-xs">
          Source type
        </Label>
        <select
          id={`${idPrefix}-source-type`}
          name="source_type"
          required
          defaultValue=""
          className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-foreground"
        >
          <option value="" disabled>
            Select source type…
          </option>
          {(EVIDENCE_SOURCE_TYPES as readonly EvidenceSourceType[]).map((t) => (
            <option key={t} value={t}>
              {EVIDENCE_SOURCE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-platform`} className="text-xs">
            Platform / network
          </Label>
          <Input
            id={`${idPrefix}-platform`}
            name="source_platform"
            placeholder="e.g. CNN, YouTube, C-SPAN, X"
            className="bg-zinc-950 border-zinc-700 text-sm"
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-program`} className="text-xs">
            Program / show / title
          </Label>
          <Input
            id={`${idPrefix}-program`}
            name="source_program"
            placeholder="Broadcast, episode, article headline…"
            className="bg-zinc-950 border-zinc-700 text-sm"
            autoComplete="off"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-url`} className="text-xs">
          Source URL (if applicable)
        </Label>
        <Input
          id={`${idPrefix}-url`}
          name="source_url"
          type="url"
          inputMode="url"
          placeholder="https://…"
          defaultValue={defaultUrl ?? ""}
          className="bg-zinc-950 border-zinc-700 text-sm"
        />
      </div>
    </div>
  );
}
