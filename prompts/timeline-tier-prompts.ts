/**
 * Model guidance for timeline[] entries (tiers are recomputed server-side from classification + evidence).
 */
export const TIMELINE_TIER_MODEL_GUIDANCE = `Timeline events (timeline[]):
Each item may include an optional numeric "timeline_tier" (1, 2, or 3) as a non-binding hint only — the platform will assign the authoritative tier using strict rules.

Tier meanings (hints for your drafting; server enforces):
- Timeline 1 (Confirmed time): explicit parseable occurred_at, corroboration across multiple evidence files, and conservative wording — only consistent with Confirmed/Conclusive classifications.
- Timeline 2 (Supported): multiple supporting signals or cross-file alignment; indirect but consistent time placement; aligns with Confirmed, Inferred, Correlated, or Conclusive when full T1 criteria are not met.
- Timeline 3 (Leads): weak, partial, inferred, uncertain, or reconstruction-heavy timing; aligns with Inferred, Reconstructed, or Uncertain; also used when only one file supports the event or timing is vague.

Never assign Timeline-1-style certainty from a single file, from reconstructed hidden text, from vague/approximate timing alone, or from pattern-only inference. Prefer broad date language when uncertain.

Contextual time inference (holidays, elections, televised or widely known public events, identifiable media moments, repeated cross-evidence references):
- You MAY infer approximate calendar placement when the text clearly alludes to such anchors and you can explain the mapping.
- Set "timing_basis": "contextual_inference" and include a full "contextual_time_inference" object whenever timing is not verbatim in the extract.
- Use "timing_basis": "direct_evidence" when an explicit date/time appears in the text; "mixed" when both apply.
- For "contextual_time_inference" always fill: reference_type (holiday | public_event | media_event | cross_evidence_pattern | other), reference_description, time_windows (array of {start?, end?, label?}), year_known (boolean), year_assumed (boolean, when the year is guessed), limitations, inference_explanation, specificity (specific_known_year | vague_or_ambiguous | multiple_possible_windows).
- If the year cannot be determined from evidence, set year_known false, explain in limitations, and use specificity "vague_or_ambiguous" or list competing windows with specificity "multiple_possible_windows" — do not arbitrarily pick one year.
- Prefer classification Inferred or Correlated for findings that depend primarily on contextual timing; do not use Conclusive for conclusions that rest solely on contextual time inference without documentary dates in the extract.

Inference techniques (shadow analysis, environmental conditions, loose event anchoring without a verbatim timestamp): keep the timeline row at Supported or Leads unless timing is independently verified; explain the technique and uncertainty in that row’s event_limitations.

Time correlation vs search ranking (do not merge categories in wording)
- Exact same-moment / verifiable timestamp alignment is stronger than “within 12 hours,” which is stronger than “same calendar date only.”
- Never describe same-date-only alignment as if it were an exact timestamp match, and never equate within-12-hour proximity with exact same-instant verification.
- When comparing events across files, state which tier applies to each side and what remains uncertain.`;
