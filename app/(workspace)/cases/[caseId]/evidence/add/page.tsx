import { EvidenceIntakeLauncher } from "@/components/evidence-intake/evidence-intake-launcher";

export default async function CaseAddEvidencePage({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  const basePath = `/cases/${caseId}/evidence/add`;
  return (
    <EvidenceIntakeLauncher
      basePath={basePath}
      contextLabel="Evidence is stored on this case. Choose how you want to add it — then open each file to view, zoom, crop, or run AI analysis."
      parentBack={{ href: `/cases/${caseId}`, label: "Back to case" }}
    />
  );
}
