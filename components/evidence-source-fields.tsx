"use client";

import { Label } from "@/components/ui/label";
import { SourcePlatformCombobox } from "@/components/source-platform-combobox";
import { SourceProgramCombobox } from "@/components/source-program-combobox";
import { SourceSiteCombobox } from "@/components/source-site-combobox";
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
  defaultPlatform,
  defaultProgram,
  variant = "default",
}: {
  idPrefix: string;
  /** Prefill URL (e.g. import-from-link). */
  defaultUrl?: string;
  /** Prefill platform/network (e.g. duplicate upload). */
  defaultPlatform?: string;
  /** Prefill program/show/title. */
  defaultProgram?: string;
  /** `intake`: light surfaces for the evidence intake flow. */
  variant?: "default" | "intake";
}) {
  const shell = "rounded-lg border border-border bg-panel p-4 space-y-4";
  const introTitle = variant === "intake" ? "Source details" : "Source (recommended)";
  const introBody = (
    <p className="text-xs text-muted-foreground leading-relaxed">
      {variant === "intake" ? (
        <>
          Optional but recommended for search, filters, and audits. Choose the closest type — use{" "}
          <span className="font-medium text-foreground">Unknown</span> only when it cannot be determined.
        </>
      ) : (
        <>
          Helps the case index, filters, and audits. Choose the closest type — use{" "}
          <span className="font-medium text-foreground">Unknown</span> only when it truly cannot be determined.
        </>
      )}
    </p>
  );
  const selectClass =
    "w-full rounded-md border border-border bg-white px-2 py-2 text-sm text-foreground";
  const inputClass =
    "border-input bg-form-field text-sm text-form-field-foreground placeholder:text-form-field-placeholder";
  const labelClass = "text-xs text-foreground font-medium";

  return (
    <div className={shell}>
      <div>
        <p className="text-xs font-semibold text-foreground">{introTitle}</p>
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
          <p className="text-[11px] leading-snug text-muted-foreground">
            Search existing networks or type a new one — matches are saved for next time.
          </p>
          <SourcePlatformCombobox
            id={`${idPrefix}-platform`}
            name="source_platform"
            variant={variant}
            defaultValue={defaultPlatform}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${idPrefix}-program`} className={labelClass}>
            Program / show / title
          </Label>
          <p className="text-[11px] leading-snug text-muted-foreground">
            Search past titles or type a new one — saved for next time.
          </p>
          <SourceProgramCombobox
            id={`${idPrefix}-program`}
            name="source_program"
            variant={variant}
            defaultValue={defaultProgram}
          />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-url`} className={labelClass}>
          Source Site (optional — e.g. wikipedia.org)
        </Label>
        <p className="text-[11px] leading-snug text-muted-foreground">
          Search saved site hosts or type one — used for grouping. Evidence is pulled from the links above.
        </p>
        <SourceSiteCombobox
          id={`${idPrefix}-url`}
          name="source_url"
          variant={variant}
          defaultValue={defaultUrl ?? ""}
        />
      </div>
    </div>
  );
}
