"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { clearTheoryPlacement, upsertTheoryPlacement } from "@/services/timeline-theory-service";

export async function saveTheoryPlacementAction(formData: FormData) {
  const caseId = formData.get("caseId");
  const eventId = formData.get("eventId");
  const iso = formData.get("provisionalOccurredAt");
  if (typeof caseId !== "string" || typeof eventId !== "string" || typeof iso !== "string") {
    throw new Error("Invalid form data");
  }
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await upsertTheoryPlacement(supabase, {
    caseId,
    userId: user.id,
    timelineEventId: eventId,
    provisionalOccurredAt: d.toISOString(),
  });
  revalidatePath(`/cases/${caseId}/timeline`);
}

export async function clearTheoryPlacementAction(formData: FormData) {
  const caseId = formData.get("caseId");
  const eventId = formData.get("eventId");
  if (typeof caseId !== "string" || typeof eventId !== "string") {
    throw new Error("Invalid form data");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  await clearTheoryPlacement(supabase, {
    caseId,
    userId: user.id,
    timelineEventId: eventId,
  });
  revalidatePath(`/cases/${caseId}/timeline`);
}
