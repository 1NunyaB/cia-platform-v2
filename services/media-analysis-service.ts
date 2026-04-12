/**
 * Media analysis — re-exports for a single import surface (prompt rules live under prompts/).
 */
export { isMediaAnalysisContext } from "@/lib/media-context";
export {
  findingTouchesPersonIdentity,
  IDENTITY_FOLLOWUP_NEXT_STEP_SNIPPET,
  needsIdentityFollowupPrompt,
} from "@/lib/identity-verification-policy";
export { normalizeMediaAnalysisDetail } from "@/lib/schemas/media-analysis-schema";
export {
  enforceAuthenticityDiscipline,
  enforceMediaFindingDiscipline,
  finalizeMediaIdentityFollowup,
} from "@/services/analysis-finding-validation";
