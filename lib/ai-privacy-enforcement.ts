/**
 * Strict, code-level guarantees for investigation / cross-case AI prompts.
 * Complements RLS and system prompts — validates assembled strings before any model call.
 */

/** Data surfaces that may appear in `buildInvestigationUserContentBlock` (no case notes, comments, or activity bodies). */
export const INVESTIGATION_AI_ALLOWED_SOURCES = [
  "evidence_files + extracted_texts (per-file extracts)",
  "entities + entity_categories",
  "evidence_clusters + members (filenames only)",
] as const;

const EXTRACTS_HEADER = "=== EXTRACTED TEXT BY FILE ===";

/**
 * Throws if the investigation prompt prefix contains forbidden section markers or is missing required structure.
 * Does not scan evidence body text (after first `--- FILE:`) to avoid false positives on document content.
 */
export function assertInvestigationPromptAllowedShape(userContent: string): void {
  if (!userContent.startsWith("CASE ID:")) {
    throw new Error("AI privacy: investigation context must start with CASE ID.");
  }
  const extractIdx = userContent.indexOf(EXTRACTS_HEADER);
  if (extractIdx === -1) {
    throw new Error("AI privacy: investigation context missing EXTRACTED TEXT section header.");
  }
  const prefix = userContent.slice(0, extractIdx);
  const forbidden = /===\s*(CASE\s+NOTES|PRIVATE\s+NOTES|COLLABORATOR\s+NOTES|USER\s+NOTES|ACTIVITY\s+LOG|COMMENTS|INVITES)/i;
  if (forbidden.test(prefix)) {
    throw new Error("AI privacy: forbidden section marker detected in investigation prompt.");
  }
  if (!prefix.includes("=== ENTITY REGISTRY (canonical labels) ===")) {
    throw new Error("AI privacy: investigation context missing entity registry section.");
  }
  if (!prefix.includes("=== EVIDENCE CLUSTERS (if any) ===")) {
    throw new Error("AI privacy: investigation context missing clusters section.");
  }
}

/**
 * Validates the assembled cross-case user message contains expected region markers (server-built only).
 */
export function assertCrossCaseUserMessageShape(fullUserMessage: string): void {
  const required = [
    "=== USER QUESTION ===",
    "=== PRIMARY: CURRENT INVESTIGATION ===",
    "=== SUPPLEMENTARY: OTHER PUBLIC INVESTIGATIONS",
  ];
  for (const r of required) {
    if (!fullUserMessage.includes(r)) {
      throw new Error(`AI privacy: cross-case message missing region: ${r}`);
    }
  }
  const bad = /===\s*(CASE\s+NOTES|PRIVATE\s+SESSION)/i;
  if (bad.test(fullUserMessage.slice(0, 4000))) {
    throw new Error("AI privacy: suspicious marker in cross-case message header.");
  }
}
