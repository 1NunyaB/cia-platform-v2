import { EvidenceIntakeLauncher } from "@/components/evidence-intake/evidence-intake-launcher";

export default function LibraryAddEvidencePage() {
  return (
    <EvidenceIntakeLauncher
      basePath="/evidence/add"
      contextLabel="Files go to your personal evidence library first — assign them to a case later from the Evidence page."
      parentBack={{ href: "/evidence", label: "Evidence Library" }}
    />
  );
}
