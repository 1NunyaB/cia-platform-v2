import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listCasesForUser } from "@/services/case-service";

/**
 * Hub route: timelines live under each case (`/cases/[caseId]/timeline`).
 * Sends users to their most recently updated case timeline, or back to Cases to pick one.
 */
export default async function TimelineHubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/cases");
  }

  let rows: Awaited<ReturnType<typeof listCasesForUser>> = [];
  try {
    rows = await listCasesForUser(supabase, user.id);
  } catch {
    rows = [];
  }

  if (rows.length === 0) {
    redirect("/cases");
  }

  redirect(`/cases/${rows[0].id}/timeline`);
}
