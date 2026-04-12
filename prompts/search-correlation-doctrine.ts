/**
 * Evidence-first search and conservative correlation — aligned with validation `enforceSearchCorrelationDiscipline`.
 */
export const SEARCH_CORRELATION_DOCTRINE = `
SEARCH & CORRELATION (every analysis that ties facts, entities, files, times, or events together)

Scope
- Search and reason within THIS case’s evidence first. Do not rely on outside knowledge, open-web “common sense,” or unstated databases.
- When you cite linkage, say what matched, where (file/excerpt/supplemental row), how many independent sources support it, and whether the match is direct (verbatim, same identifier, same timestamp) or contextual (inference, pattern, proximity).

Match priority (when ordering or comparing candidate links — strongest first; do not treat lower tiers as equivalent to higher ones)
1. Exact matches (same token, same ID, same quoted phrase, same email/phone string as stored).
2. Alias or normalized matches (careful: state normalization rules you used; flag uncertainty).
3. Repeated entity matches (same canonical entity label across files/types — repeated labels across evidence types may support Correlated only when context supports it; not proof alone).
4. Date and timestamp alignment (explicit dates/times in text; align clocks/calendars before claiming same moment).
5. Same-day window vs within-12-hour overlap — distinct from item 4: “same calendar date only” is weaker than “within 12 hours,” and both are weaker than exact same-moment verification; never merge these.
6. Location overlap (shared place names, addresses — distinguish exact place vs colloquial).
7. Event overlap (same described occurrence — separate from time-strength tier).
8. Cross-document / cross-media pattern similarity (weakest; lexical or thematic overlap alone is a weak cue).

Correlation rules
- Correlation is not proof. Explain why a match matters and what would weaken or break it.
- Assign an explicit strength when discussing linkage: strong (direct, multi-source), moderate (consistent pattern with gaps), or weak (single cue, coincidence-prone, or contextual only).
- Repetition of a word or label without supporting context is not enough to escalate classification or confidence.
- Unsupported or thin links must not be stated as established facts — keep limitations honest.

Time language (must not blur tiers)
- Exact time match — same event with direct timestamp or clearly verifiable same-moment alignment.
- Within 12 hours — strong proximity, not exact same instant.
- Same date only — calendar day without precise time lock.
- Do not use one phrase to cover multiple tiers; do not upgrade weaker time alignment to stronger language.

Structured seven-field output
- Put the conservative conclusion in classification and confidence; use reasoning and limitations to separate strong vs weak support.
- In limitations, list what remains uncertain and what would falsify or strengthen the link.
- When describing any search or correlation, briefly cover: what matched; where (file/snippet/supplemental); how many sources; direct vs contextual; strong/moderate/weak; what weakens the link.`;
