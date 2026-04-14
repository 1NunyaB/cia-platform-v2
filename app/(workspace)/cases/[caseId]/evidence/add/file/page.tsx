import { EvidenceIntakeShell } from "@/components/evidence-intake/evidence-intake-shell";
import { EvidenceIntakeSingleForm } from "@/components/evidence-intake/evidence-intake-forms";

export default async function CaseAddEvidenceFilePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return (
    <EvidenceIntakeShell
      backHref={`/cases/${caseId}/evidence/add`}
      backLabel="Add evidence options"
      title="Upload file"
      subtitle="One document from your computer. PDFs and images open inline with zoom; other types use the in-app viewer where supported."
    >
      <EvidenceIntakeSingleForm mode="case" caseId={caseId} />
    </EvidenceIntakeShell>
  );
}
