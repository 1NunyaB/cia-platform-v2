import type { AppSupabaseClient, ContributionKind } from "@/types";

export async function recordContribution(
  supabase: AppSupabaseClient,
  input: {
    caseId: string;
    userId: string;
    kind: ContributionKind;
    refId?: string | null;
    meta?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("contributions").insert({
    case_id: input.caseId,
    user_id: input.userId,
    kind: input.kind,
    ref_id: input.refId ?? null,
    meta: input.meta ?? {},
  });
  if (error) throw new Error(error.message);
}
