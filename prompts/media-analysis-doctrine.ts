/**
 * Baseline media caution — included for all analyses (transcript/OCR can appear in any extract).
 */
export const MEDIA_ANALYSIS_BASELINE_RULES = `
Media and text extraction (all files)
- When the extract includes transcript lines, OCR output, captions, timestamps, filenames, or embedded metadata strings, you may use them — but label what is directly visible/audible versus what comes only from transcript, OCR, captions, or metadata.
- Do not treat resemblance, similar appearance, or pattern alone as proof of identity.
- Public or widely shared media can corroborate timing or content themes; it is not automatic proof of authenticity, chain of custody, or intent.
- Prefer conservative classifications when quality is low, media is partial, cropped, muted, clipped, or metadata-poor.
- Set "authenticity_label" and "authenticity_notes" from provenance and integrity (source origin, metadata, cross-source agreement, media integrity); this is independent from the analytical "classification" field — Confirmed content can still be Unverified for authenticity.`;

/**
 * Extended rules when the evidence file is image, video, audio, or OCR-heavy (see lib/media-context.ts).
 */
export const MEDIA_ANALYSIS_EXTENDED_RULES = `
MEDIA / OCR / TRANSCRIPT MODE (this file is treated as media-class evidence)
You MUST still return the seven core finding fields unchanged in meaning, plus a complete "media_analysis" object (see JSON keys below).

Core behavior
- Identify what is directly visible or audible in the media (or clearly shown in a preview frame if described in text).
- Identify what is inferred only from transcript, OCR, captions, or metadata — label those as interpreted/extracted, not as raw audiovisual certainty.
- Do not over-identify unclear people in images or video; do not claim a specific individual from resemblance alone.
- Compare across dimensions when relevant (visual elements, spoken/transcript wording, timestamps, locations, entities, event context) — but do not claim the same event or the same person without sufficient support in the extract.

Identity verification (strict)
- Confirmed identification of a person requires an explicit name or unambiguous identifier in text layers (document text, transcript, captions, or reliable metadata). Visual-only media must NOT yield Confirmed identity.
- Unnamed individuals: classify identity-related conclusions as Inferred, Correlated, or Uncertain — not Confirmed.
- Comparisons to known individuals: describe as possible match, visual similarity, or consistent features — never claim certain identity without explicit naming in evidence.
- Multiple images or sources may raise confidence toward Correlated or Inferred, but still do not justify Confirmed without explicit naming.
- Conclusive (for identity) only when the person is explicitly named in evidence and strongly verified in the extract; otherwise use lower classifications.

Time alignment (pick ONE strength for timestamp_date_strength; do not conflate categories):
- "exact_match" — same event with a direct timestamp or clearly verifiable time alignment in the extract.
- "within_12_hours" — strong proximity (within twelve hours) but NOT an exact same-moment lock.
- "same_date" — same calendar date only, without precise time confirmation.
- "time_adjacent_only" — loose adjacency / sequence without a firm clock or calendar anchor.
- "unclear" — timing cannot be determined responsibly from the extract.
- "none" — no usable time anchor.

identity_basis (pick ONE):
- "named_in_evidence" — the person's name appears in the main extracted text.
- "transcript_caption_or_metadata_named" — name appears only in transcript, captions, or embedded metadata (still explicit naming).
- "visual_only" — no explicit name in any text layer; identification would rely on appearance alone.
- "unnamed_unknown" — subject is unnamed or unknown.
- "mixed" — combination of the above; explain in narrative fields.

identity_claim_kind (pick ONE):
- "named_identity" — asserting a specific named person tied to explicit text.
- "inferred_match" — inferred from cues without definitive naming.
- "possible_match" — candidate match language only.
- "visual_similarity" — similarity / consistent features, not identity proof.
- "unknown_individual" — individual not identified.

Confidence: reduce confidence when media is low-quality, partial, muted, clipped, or metadata-poor; say why in limitations and media_analysis.

Comparison checklist (narrate in reasoning/limitations when comparing is relevant): visual elements; spoken content; transcript wording; timestamps; locations; entities; event context — without claiming sameness without support.

Required JSON object "media_analysis" (all string fields required; use honest limitation text if unknown):
- "visible_audible_evidence" — what is directly seen/heard (or explicitly described as on-screen/on-tape), separated from interpretation.
- "transcript_ocr_or_caption_interpreted" — what depends on transcript, OCR, captions, or similar text layers (not direct audiovisual certainty).
- "metadata_notes" — filenames, container metadata, embedded dates, duration hints, etc., and how you use them cautiously.
- "timestamp_date_strength" — exactly one of: "exact_match", "within_12_hours", "same_date", "time_adjacent_only", "unclear", "none".
- "identity_certainty" — exactly one of: "none", "low", "moderate", "high" (person/face/voice ID from THIS file only; "none" when identification is not justified).
- "identity_basis" — exactly one of: "named_in_evidence", "transcript_caption_or_metadata_named", "visual_only", "unnamed_unknown", "mixed".
- "identity_claim_kind" — exactly one of: "named_identity", "inferred_match", "possible_match", "visual_similarity", "unknown_individual".
- "cannot_be_confirmed" — what remains uncertain or cannot be confirmed from this evidence alone.
`;

export const MEDIA_ANALYSIS_JSON_BLOCK = `
Include a top-level "media_analysis" object with EXACT keys:
- visible_audible_evidence (string)
- transcript_ocr_or_caption_interpreted (string)
- metadata_notes (string)
- timestamp_date_strength (string, one of the six allowed values above)
- identity_certainty (string: none | low | moderate | high)
- identity_basis (string: named_in_evidence | transcript_caption_or_metadata_named | visual_only | unnamed_unknown | mixed)
- identity_claim_kind (string: named_identity | inferred_match | possible_match | visual_similarity | unknown_individual)
- cannot_be_confirmed (string)
`;
