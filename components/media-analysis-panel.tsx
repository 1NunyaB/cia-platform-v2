import type { MediaAnalysisDetail } from "@/types/analysis";
import {
  IDENTITY_BASIS_LABELS,
  IDENTITY_CLAIM_KIND_LABELS,
  TIMESTAMP_DATE_STRENGTH_LABELS,
} from "@/types/analysis";
import { needsIdentityFollowupPrompt } from "@/lib/identity-verification-policy";

const IDENTITY_CERTAINTY_LABELS: Record<MediaAnalysisDetail["identity_certainty"], string> = {
  none: "None — do not treat as identified",
  low: "Low",
  moderate: "Moderate",
  high: "High (Conclusive identity still requires explicit naming + verification in text layers)",
};

/**
 * Structured media/OCR/transcript breakdown — shown below the seven-field finding when stored.
 */
export function MediaAnalysisPanel({ detail }: { detail: MediaAnalysisDetail }) {
  const tsLabel = TIMESTAMP_DATE_STRENGTH_LABELS[detail.timestamp_date_strength];
  const idCertLabel = IDENTITY_CERTAINTY_LABELS[detail.identity_certainty];
  const basisLabel = IDENTITY_BASIS_LABELS[detail.identity_basis];
  const claimLabel = IDENTITY_CLAIM_KIND_LABELS[detail.identity_claim_kind];
  const suggestFollowup = needsIdentityFollowupPrompt(detail);

  return (
    <div
      className="rounded-xl border border-zinc-800 bg-zinc-950 text-foreground shadow-inner"
      role="region"
      aria-label="Media and transcript analysis"
    >
      <div className="border-b border-zinc-800 px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Media & text layers</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Direct visible/audible observations are separated from transcript, OCR, captions, and metadata. Identity
          claims distinguish named vs possible match vs unknown; visual-only is never Confirmed identity.
        </p>
      </div>
      <dl className="divide-y divide-zinc-800/90">
        <MediaRow label="Visible / audible" value={detail.visible_audible_evidence} />
        <MediaRow
          label="Transcript / OCR / captions (interpreted)"
          value={detail.transcript_ocr_or_caption_interpreted}
          hint="Extracted or text-layer meaning — not raw audiovisual certainty."
        />
        <MediaRow label="Metadata & filenames" value={detail.metadata_notes} />
        <div className="px-4 py-4 sm:grid sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Time match strength
          </dt>
          <dd className="mt-1 text-sm sm:mt-0 space-y-1">
            <p className="font-medium text-foreground">{tsLabel}</p>
            <p className="text-xs text-muted-foreground">
              Code: <code className="text-zinc-400">{detail.timestamp_date_strength}</code>
            </p>
          </dd>
        </div>
        <div className="px-4 py-4 sm:grid sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Identity — basis
          </dt>
          <dd className="mt-1 text-sm sm:mt-0 space-y-1">
            <p className="text-foreground">{basisLabel}</p>
            <p className="text-xs text-muted-foreground">
              Code: <code className="text-zinc-400">{detail.identity_basis}</code>
            </p>
          </dd>
        </div>
        <div className="px-4 py-4 sm:grid sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Identity — claim type
          </dt>
          <dd className="mt-1 text-sm sm:mt-0 space-y-1">
            <p className="text-foreground">{claimLabel}</p>
            <p className="text-xs text-muted-foreground">
              Code: <code className="text-zinc-400">{detail.identity_claim_kind}</code>
            </p>
          </dd>
        </div>
        <div className="px-4 py-4 sm:grid sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4">
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Identity certainty (this file)
          </dt>
          <dd className="mt-1 text-sm sm:mt-0">
            <p className="text-foreground">{idCertLabel}</p>
          </dd>
        </div>
        <MediaRow label="Cannot be confirmed" value={detail.cannot_be_confirmed} emphasized />
        {suggestFollowup ? (
          <div className="px-4 py-3 bg-zinc-900/40 border-t border-zinc-800">
            <p className="text-xs font-medium text-sky-400/90">Suggested investigator follow-up</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              If identity remains unclear, use the Next step field on the structured finding — it may include options
              to search this case, external sources, compare to known individuals, or record a suspected identity in a
              note.
            </p>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

function MediaRow({
  label,
  value,
  hint,
  emphasized,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasized?: boolean;
}) {
  return (
    <div className="px-4 py-4 sm:grid sm:grid-cols-[minmax(0,11rem)_1fr] sm:gap-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-1 sm:mt-0">
        {hint ? <p className="text-[11px] text-sky-400/80 mb-1">{hint}</p> : null}
        <p
          className={
            emphasized
              ? "text-sm leading-relaxed text-foreground whitespace-pre-wrap font-medium"
              : "text-sm leading-relaxed text-foreground whitespace-pre-wrap"
          }
        >
          {value}
        </p>
      </dd>
    </div>
  );
}
