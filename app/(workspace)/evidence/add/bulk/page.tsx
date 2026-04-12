import { EvidenceIntakeShell } from "@/components/evidence-intake/evidence-intake-shell";
import { EvidenceIntakeBulkForm } from "@/components/evidence-intake/evidence-intake-forms";

export default function LibraryAddEvidenceBulkPage() {
  return (
    <EvidenceIntakeShell
      backHref="/evidence/add"
      backLabel="Add evidence options"
      title="Upload multiple files"
      subtitle="Batch upload to your library with shared source metadata on every file."
    >
      <EvidenceIntakeBulkForm mode="library" />
    </EvidenceIntakeShell>
  );
}
