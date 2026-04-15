import { EvidenceIntakeShell } from "@/components/evidence-intake/evidence-intake-shell";
import { EvidenceIntakeUrlForm } from "@/components/evidence-intake/evidence-intake-forms";
import { createClient } from "@/lib/supabase/server";
import { listCasesForUser } from "@/services/case-service";

export default async function LibraryAddEvidenceUrlPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const casesForAssign = user ? await listCasesForUser(supabase, user.id) : [];

  return (
    <EvidenceIntakeShell
      backHref="/evidence/add"
      backLabel="Add evidence options"
      title="Import from URL"
      subtitle="Import from public links (protocol optional) — distinct from uploading files from disk."
    >
      <EvidenceIntakeUrlForm
        mode="library"
        casesForAssign={casesForAssign.map((c) => ({ id: c.id, title: c.title }))}
      />
    </EvidenceIntakeShell>
  );
}
