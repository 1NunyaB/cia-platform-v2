import { EvidenceIntakeShell } from "@/components/evidence-intake/evidence-intake-shell";
import { EvidenceIntakeUrlForm } from "@/components/evidence-intake/evidence-intake-forms";

export default async function CaseAddEvidenceUrlPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return (
    <EvidenceIntakeShell
      backHref={`/cases/${caseId}/evidence/add`}
      backLabel="Add evidence options"
      title="Import from URL"
      subtitle="Paste public links (protocol optional). This path is separate from direct file uploads."
    >
      <EvidenceIntakeUrlForm mode="case" caseId={caseId} />
    </EvidenceIntakeShell>
  );
}
