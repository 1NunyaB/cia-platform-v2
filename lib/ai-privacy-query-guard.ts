/**
 * Blocks user queries that attempt to exfiltrate private notes, collaborator content, or similar
 * before calling the model. Legitimate questions about privacy policy are not blocked.
 */

export type PrivacyQueryResult =
  | { blocked: false }
  | { blocked: true; reason: string };

/** Imperative exfiltration / jailbreak-style requests (not factual "does the AI see X?" questions). */
const EXFIL_PATTERNS: { re: RegExp; reason: string }[] = [
  {
    re: /\b(show|reveal|list|dump|export|display|give)\b[\s\S]{0,160}\bprivate\s+notes?\b/i,
    reason: "Requests to surface private notes cannot be processed.",
  },
  {
    re: /\b(show|reveal|list|dump|export)\b[\s\S]{0,160}\bcollaborator\s+(notes?|comments?)\b/i,
    reason: "Requests to surface collaborator notes or comments cannot be processed.",
  },
  {
    re: /\b(ignore|bypass|circumvent|override|disable)\b[\s\S]{0,40}\b(privacy|rules|policy|restrictions)\b/i,
    reason: "Requests to bypass privacy rules cannot be processed.",
  },
  {
    re: /\b(leak|exfiltrate|steal)\b[\s\S]{0,40}\b(notes?|passwords?|credentials?|pii|personal\s+data)\b/i,
    reason: "This type of request cannot be processed.",
  },
  {
    re: /\bwhat\s+(did|does)\s+.{0,40}\b(say|write)\b[\s\S]{0,30}\b(in\s+)?(their|her|his)\s+private\b/i,
    reason: "Questions targeting another person’s private notes cannot be answered.",
  },
];

export function evaluateCrossCaseQueryPrivacy(query: string): PrivacyQueryResult {
  const q = query.trim();
  if (!q) return { blocked: false };
  for (const { re, reason } of EXFIL_PATTERNS) {
    if (re.test(q)) {
      return { blocked: true, reason };
    }
  }
  return { blocked: false };
}
