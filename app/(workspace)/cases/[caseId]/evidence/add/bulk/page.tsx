import { EvidenceIntakeShell } from "@/components/evidence-intake/evidence-intake-shell";
import { EvidenceIntakeBulkForm } from "@/components/evidence-intake/evidence-intake-forms";

export default async function CaseAddEvidenceBulkPage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return (
    <EvidenceIntakeShell
      backHref={`/cases/${caseId}/evidence/add`}
      backLabel="Add evidence options"
      title="Upload multiple files"
      subtitle="Select several files at once. Shared source details apply to each file in the batch."
    >
      <EvidenceIntakeBulkForm mode="case" caseId={caseId} />
    </EvidenceIntakeShell>
  );
}
