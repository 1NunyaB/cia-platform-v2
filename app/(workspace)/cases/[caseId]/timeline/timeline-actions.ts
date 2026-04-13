"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertPlatformDeleteAdmin } from "@/lib/admin-guard";
import { logActivity } from "@/services/activity-service";
import { regenerateReconstructedTimeline } from "@/services/reconstructed-timeline-service";

export async function regenerateReconstructedTimelineAction(formData: FormData) {
  const caseId = formData.get("caseId");
  if (typeof caseId !== "string" || !caseId) {
    throw new Error("Missing case id");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  assertPlatformDeleteAdmin(user);

  await regenerateReconstructedTimeline(supabase, caseId);
  await logActivity(supabase, {
    action: "timeline_reconstructed.regenerated_admin",
    caseId,
    actorId: user.id,
    entityType: "case",
    entityId: caseId,
    payload: { destructive_reset: true },
  });
  revalidatePath(`/cases/${caseId}/timeline`);
}
