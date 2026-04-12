/**
 * Rules for timeline events derived only from extracted text.
 */
export const TIMELINE_EXTRACTION_RULES = `TIMELINE EXTRACTION (from extracted text only)
- Each item needs a "title" grounded in what the text states (meeting, filing, statement, death, etc.).
- "occurred_at": ISO-8601 string when an explicit date or time appears in the text, OR when you place the event in time using a structured contextual anchor (holiday, known public or media event) and document that anchor in "contextual_time_inference" with timing_basis "contextual_inference" or "mixed". If timing cannot be placed even loosely, use null.
- "summary": one or two sentences paraphrasing only what the text supports; if timing is vague or inferred from context, say so in the summary and in contextual_time_inference.limitations.
- If no datable or sequence-worthy events appear, return an empty array.
- Do not invent facts; contextual inference must tie to explicit references in the text (e.g. "Thanksgiving weekend", "the night of the debate") and list uncertainty or multiple possible windows when the year or exact range is not determined.`;
