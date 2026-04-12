import { EvidenceIntakeShell } from "@/components/evidence-intake/evidence-intake-shell";
import { EvidenceIntakeUrlForm } from "@/components/evidence-intake/evidence-intake-forms";

export default function LibraryAddEvidenceUrlPage() {
  return (
    <EvidenceIntakeShell
      backHref="/evidence/add"
      backLabel="Add evidence options"
      title="Import from URL"
      subtitle="Import into your library from a public link — distinct from uploading files from disk."
    >
      <EvidenceIntakeUrlForm mode="library" />
    </EvidenceIntakeShell>
  );
}
