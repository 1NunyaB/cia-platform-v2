import { EvidenceIntakeShell } from "@/components/evidence-intake/evidence-intake-shell";
import { EvidenceIntakeSingleForm } from "@/components/evidence-intake/evidence-intake-forms";

export default function LibraryAddEvidenceFilePage() {
  return (
    <EvidenceIntakeShell
      backHref="/evidence/add"
      backLabel="Add evidence options"
      title="Upload file"
      subtitle="One document stored in your library (no case required yet)."
    >
      <EvidenceIntakeSingleForm mode="library" />
    </EvidenceIntakeShell>
  );
}
