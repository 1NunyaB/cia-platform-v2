import { createClient } from "@/lib/supabase/server";
import { listCasesForUser } from "@/services/case-service";
import { CasesPageClient, type CasesPageRow } from "@/components/cases-page-client";

export default async function CasesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <CasesPageClient rows={[]} />;
  }

  let rows: Awaited<ReturnType<typeof listCasesForUser>> = [];
  try {
    rows = await listCasesForUser(supabase, user.id);
  } catch {
    rows = [];
  }

  const caseIds = rows.map((c) => c.id);
  const memberCounts = new Map<string, number>();
  if (caseIds.length > 0) {
    const { data: members } = await supabase.from("case_members").select("case_id").in("case_id", caseIds);
    for (const m of members ?? []) {
      const id = String(m.case_id ?? "");
      if (!id) continue;
      memberCounts.set(id, (memberCounts.get(id) ?? 0) + 1);
    }
  }

  const pageRows: CasesPageRow[] = rows.map((c) => ({
    id: c.id,
    title: c.title,
    description: c.description ?? null,
    created_at: c.created_at,
    updated_at: c.updated_at,
    created_by: c.created_by,
    incident_city: c.incident_city ?? null,
    incident_state: c.incident_state ?? null,
    investigation_started_at: c.investigation_started_at ?? null,
    investigation_on_hold_at: c.investigation_on_hold_at ?? null,
    assigned_investigators: memberCounts.get(c.id) ?? 0,
  }));

  return <CasesPageClient rows={pageRows} />;
}
