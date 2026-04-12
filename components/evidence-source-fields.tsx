"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
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
  variant = "default",
}: {
  idPrefix: string;
  /** Prefill URL (e.g. import-from-link). */
  defaultUrl?: string;
  /** `intake`: light surfaces for the evidence intake flow. */
  variant?: "default" | "intake";
}) {
  const shell =
    variant === "intake"
      ? "rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-4"
      : "rounded-md border border-zinc-700/80 bg-zinc-900/40 p-3 space-y-3";
  const introTitle = variant === "intake" ? "Source details" : "Source (recommended)";
  const introBody =
    variant === "intake" ? (
      <p className="text-xs text-zinc-600 leading-relaxed">
        Optional but recommended for search, filters, and audits. Choose the closest type — use{" "}
        <span className="font-medium text-zinc-800">Unknown</span> only when it cannot be determined.
      </p>
    ) : (
      <p className="text-[11px] text-muted-foreground mt-0.5">
        Helps the case index, filters, and audits. Choose the closest type — use{" "}
        <span className="text-zinc-300">Unknown</span> only when it truly cannot be determined.
      </p>
    );
  const selectClass =
    variant === "intake"
      ? "w-full rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm text-zinc-950"
      : "w-full rounded-md border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-foreground";
  const inputClass =
    variant === "intake"
      ? "bg-white border-zinc-300 text-sm text-zinc-950 placeholder:text-zinc-400"
      : "bg-zinc-950 border-zinc-700 text-sm";
  const labelClass = variant === "intake" ? "text-xs text-zinc-800" : "text-xs";

  return (
    <div className={shell}>
      <div>
        <p className={cn("text-xs font-semibold", variant === "intake" ? "text-zinc-900" : "text-foreground")}>
          {introTitle}
        </p>
        {introBody}
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-source-type`} className={labelClass}>
          Source type
        </Label>
        <select
          id={`${idPrefix}-source-type`}
          name="source_type"
          required
          defaultValue=""
          className={selectClass}
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
          <Label htmlFor={`${idPrefix}-platform`} className={labelClass}>
            Platform / network
          </Label>
          <Input
            id={`${idPrefix}-platform`}
            name="source_platform"
            placeholder="e.g. CNN, YouTube, C-SPAN, X"
            className={inputClass}
            autoComplete="off"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-program`} className={labelClass}>
            Program / show / title
          </Label>
          <Input
            id={`${idPrefix}-program`}
            name="source_program"
            placeholder="Broadcast, episode, article headline…"
            className={inputClass}
            autoComplete="off"
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-url`} className={labelClass}>
          Source URL (if applicable)
        </Label>
        <Input
          id={`${idPrefix}-url`}
          name="source_url"
          type="url"
          inputMode="url"
          placeholder="https://…"
          defaultValue={defaultUrl ?? ""}
          className={inputClass}
        />
      </div>
    </div>
  );
}
