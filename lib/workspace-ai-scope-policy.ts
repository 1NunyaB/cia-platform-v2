/**
 * Guardrails for workspace evidence assistant scope.
 * Enforced before any model call to keep the assistant focused on evidence/investigation analysis.
 */

export const WORKSPACE_AI_SCOPE_REFUSAL =
  "That information is outside my allowed scope. I can help analyze the evidence instead.";

export type WorkspaceAiPolicyResult = {
  blocked: boolean;
  reason:
    | "targeted_identity_name"
    | "admin_owner_identity"
    | "account_private_data"
    | "platform_management"
    | "cross_user_private";
};

function normalizeText(input: string): string {
  return input.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Matches "kela small" with punctuation/spacing noise and close textual variations. */
function containsBlockedTargetName(input: string): boolean {
  const normalized = normalizeText(input);
  const loose = normalized.replace(/[^a-z0-9]/g, "");
  const kelaSmallLoose = /k[e3]l[a@]s[mn]a?ll/.test(loose);
  const separated = /\bk[^\w]{0,3}e[^\w]{0,3}l[^\w]{0,3}a\b[\s\W_]{0,8}\bs[^\w]{0,3}m[^\w]{0,3}a[^\w]{0,3}l[^\w]{0,3}l\b/.test(
    normalized,
  );
  return kelaSmallLoose || separated;
}

const BLOCK_PATTERNS: Array<{ reason: WorkspaceAiPolicyResult["reason"]; re: RegExp }> = [
  {
    reason: "admin_owner_identity",
    re: /\b(admin|administrator|site owner|owner|operator|who runs this|who created this|who built this|who manages this)\b/i,
  },
  {
    reason: "admin_owner_identity",
    re: /\b(admin email|owner email|operator email|support email)\b/i,
  },
  {
    reason: "account_private_data",
    re: /\b(account info|account information|personal account|profile details|email address|phone number|home address|identity)\b/i,
  },
  {
    reason: "cross_user_private",
    re: /\b(other user'?s notes|someone else'?s notes|private notes|private user data|another user)\b/i,
  },
  {
    reason: "platform_management",
    re: /\b(platform management|backend admin|internal ops|moderation internals|billing|subscription|infrastructure)\b/i,
  },
];

export function evaluateWorkspaceAiMessagePolicy(message: string): WorkspaceAiPolicyResult | null {
  const trimmed = message.trim();
  if (!trimmed) return null;

  if (containsBlockedTargetName(trimmed)) {
    return { blocked: true, reason: "targeted_identity_name" };
  }

  for (const p of BLOCK_PATTERNS) {
    if (p.re.test(trimmed)) return { blocked: true, reason: p.reason };
  }

  return null;
}

