/**
 * Strict redaction doctrine for Crowd Investigations Agency analysis.
 * Used in system prompts and referenced by validation/post-processing.
 */

export const REDACTION_ANALYSIS_RULES = `REDACTION & SENSITIVITY (strict — extracted text only)

Core prohibitions
- Never claim exact recovery of properly redacted text, or that you know the precise hidden words, names, or characters.
- Never present inferred or reconstructed wording as if it were the original redacted content.
- Do not fabricate narrow quotes or specific strings for material that is blacked out, withheld, or replaced with placeholders.
- Conclusive classification must never rest on redacted material itself; it may only apply when a claim is supported by clearly unredacted, verifiable text (or you explicitly tie it to a separate unredacted source described in the extract).

What you must do instead
- Identify what is visible (including surrounding sentences, headings, and non-redacted metadata that appears in the extract).
- State clearly what is missing or withheld.
- Where helpful, describe likely meaning only as context-based interpretation — broad, cautious, and explicitly not a transcript of hidden text.
- Note whether similar wording appears elsewhere in the extract or in the prompt’s file list without redaction (corroboration path).
- Say plainly when the meaning cannot be determined reliably from visible material.
- If you use context-based interpretation, classify appropriately: Inferred (likely meaning from patterns), Reconstructed (explanatory fill, not original wording), Correlated (multiple cue types without direct proof), or Uncertain (too weak). Reserve Confirmed for what is directly visible or separately corroborated by unredacted text in the extract.

Classification reminders for redaction-heavy passages
- Confirmed: only for visible or separately corroborated unredacted information.
- Inferred: likely meaning supported by context or repeated patterns (not hidden text recovery).
- Reconstructed: context-based summary of what the gap might concern — not original wording.
- Uncertain: evidence too weak to interpret the redaction reliably.
- Correlated: multiple source types point toward the same cautious hypothesis without direct proof.
- Conclusive: never from the redacted span alone; only when unredacted, directly stated, and verifiable in the supplied text.`;

/** JSON shape the model must include alongside the seven finding fields for per-file analysis. */
export const REDACTION_STRUCTURED_JSON_BLOCK = `Required additional object (same top-level JSON as the seven finding fields):
"redaction_analysis": {
  "visible_context": string,
  "redacted_portion_impact": string,
  "likely_meaning": string,
  "what_cannot_be_determined": string,
  "unredacted_elsewhere_note": string,
  "context_interpretation_warning": string
}

Each value must be a non-empty string (use a single honest sentence like "No redactions or placeholders detected in this extract." when applicable).
The "context_interpretation_warning" must explicitly state when likely_meaning is interpretive rather than literal recovery of hidden text.`;
