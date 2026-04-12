/**
 * Authenticity is evaluated independently from classification (Confirmed may still be Unverified).
 */
export const AUTHENTICITY_DOCTRINE = `
Authenticity (required for every response — separate from classification)
Include two top-level JSON keys alongside the seven finding fields:
- "authenticity_label" — exactly one of these slugs (use underscores):
  - "verified_by_source" — clear origin from a trusted primary source; official or original material.
  - "strongly_corroborated" — multiple independent sources support the same substantive content (when inferable from this extract alone, note limits).
  - "likely_authentic" — no clear manipulation; reasonable context; not independently verified.
  - "unverified" — unclear origin or no corroboration available from this file.
  - "inconsistent" — conflicts with other known evidence or internal contradictions/mismatched details (describe in authenticity_notes).
  - "potentially_manipulated" — signs of editing, alteration, deepfake, clipping, staging, metadata anomalies, or suspicious media integrity (describe in authenticity_notes).

- "authenticity_notes" — short paragraph on: source origin; metadata consistency; cross-source agreement (if visible in extract); media integrity; contradictions. Use honest limits when the extract cannot support a stronger label.

Do not conflate authenticity with classification: a finding can be analytically Confirmed yet authenticity Unverified if the file itself cannot be authenticated.`;
