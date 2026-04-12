import type { MediaAnalysisDetail } from "@/types/analysis";

/** Finding text appears to assert who someone is (not only objects/events). */
export function findingTouchesPersonIdentity(findingAnswer: string, evidenceBasis: string): boolean {
  const blob = `${findingAnswer}\n${evidenceBasis}`;
  return /\b(identity|identified as|who (is|was)|same (man|woman|person|individual)|resembl|look(s)? like|facial|face (match|comparison)|doppelganger|suspect|subject|perpetrator|defendant|accused|individual (in|shown|visible))\b/i.test(
    blob,
  );
}

export function needsIdentityFollowupPrompt(media: MediaAnalysisDetail): boolean {
  if (media.identity_basis === "visual_only" || media.identity_basis === "unnamed_unknown") {
    return true;
  }
  if (media.identity_claim_kind === "possible_match" || media.identity_claim_kind === "visual_similarity") {
    return true;
  }
  if (media.identity_certainty === "none" || media.identity_certainty === "low") {
    return true;
  }
  return false;
}

export const IDENTITY_FOLLOWUP_NEXT_STEP_SNIPPET =
  "Would you like to search for a possible match? Options: search within this case; search external sources (news, media); compare with known individuals; or record a suspected identity in a case note.";
