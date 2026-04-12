"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
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

  await regenerateReconstructedTimeline(supabase, caseId);
  revalidatePath(`/cases/${caseId}/timeline`);
}
