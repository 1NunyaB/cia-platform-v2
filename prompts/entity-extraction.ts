/**
 * Rules for structured entity extraction. Composed into the main investigation system prompt.
 * Entity types must match workspace category labels for UI grouping.
 */
export const ENTITY_EXTRACTION_RULES = `ENTITY EXTRACTION (from extracted text only)
- Extract only people, organizations, locations, or other referents that are explicitly named or clearly identifiable in the text.
- Do not infer identities from hints, tone, or stereotypes.
- Each entity needs: "label" (as written or a neutral paraphrase if the text uses a clear role title only), "entity_type" as EXACTLY one of:
  Core Actors, Money, Political, Tech, Intel, Convicted, Accusers, Accused, Dead
  Pick the closest bucket; if none fits well, use the least speculative option and keep the label faithful to the text.
- "mentions": optional short snippets copied or lightly trimmed from the text that support the entity (do not fabricate snippets).
- If the text does not support any entities, return an empty array.`;
