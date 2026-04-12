/**
 * Concealed / coded / euphemistic language — conservative; never treat possible code as proven without evidence.
 */
export const CONCEALED_LANGUAGE_DOCTRINE = `
CONCEALED LANGUAGE & EUPHEMISM REVIEW (required JSON object: "concealed_language_analysis")
Stay strictly within THIS file’s extracted text plus entities/timeline/filenames you list in the same JSON response.
Do NOT import outside assumptions, internet slang lore, or “everyone knows” code meanings unless the extract itself ties the usage to that reading with clear support.

Purpose
- Flag repeated unusual words, euphemisms, substitutions, or phrasing that may be non-literal or coded.
- Compare how terms are used here vs ordinary meaning; note when usage is inconsistent with plain sense.
- When your supplemental arrays reference other case filenames or linked ideas, you may note cross-file repetition only as hypothesis to verify — not as proven.

Classification alignment (for the main seven fields — do not violate these with the concealed-language block)
- Ordinary or benign usage: do not escalate the main finding; often Uncertain or low confidence for “coded meaning” claims.
- Single unusual occurrence in this extract: treat as weak — main classification should stay conservative (often Uncertain) unless the text itself supports more.
- Repeated unusual usage within this source: may support Inferred-level hypotheses about pattern (still clearly labeled).
- Similar phrasing echoed across multiple case sources (when visible via your supplemental links or explicit references in text): may support Correlation — not Conclusive for hidden meaning.
- Never assign Conclusive on the basis of inferred or coded interpretation alone; Conclusive requires direct, verifiable support in plain text — not decoded slang.

Object shape — "concealed_language_analysis":
{
  "overview": string — short summary of whether this extract shows anything worth flagging; if nothing, say so and use empty flagged_phrases,
  "case_only_scope_note": string — confirm analysis uses only this run’s evidence and structured supplemental hints; no outside world knowledge,
  "conservative_summary": string — one paragraph: overall conservative takeaway,
  "flagged_phrases": [
    {
      "flagged_phrase": string — exact term or short phrase,
      "why_it_was_flagged": string,
      "where_it_appears": string — locations/snippets in this extract (quote lightly),
      "occurrence_summary": string — how often / distribution in this extract,
      "surrounding_context": string — nearby entities, dates, places, events, transactions, or people as actually stated,
      "ordinary_vs_suspicious": string — whether usage fits ordinary meaning or suggests non-literal reading; say if unclear,
      "repeated_usage": string — repetition within this file and, if supported by extract/supplemental, across other named case items,
      "possible_non_literal_meaning": string — cautious alternatives suggested by context — NOT asserted as fact,
      "what_cannot_be_determined": string — explicit limits,
      "usage_strength": one of: "ordinary_likely" | "isolated_unusual" | "repeated_within_source" | "repeated_cross_source"
    }
  ]
}

If there are no credible flags, set flagged_phrases to [] and explain in overview. Never fabricate repeated cross-source usage without textual or same-response supplemental support.`;
