import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EvidenceFilePreview } from "@/components/evidence-file-preview";
import { EvidenceRecoveryWorkflow } from "@/components/evidence-recovery-workflow";

/** Primary embedded file viewer: zoom, scroll/pan, optional crop/edit (derivatives named e.g. name__0001.png). */
export function EvidenceInlinePreviewCard({
  evidenceId,
  showCropToolbar = false,
  mimeType = null,
  caseId = null,
}: {
  evidenceId: string;
  /** Signed-in users: crop/edit strip below the viewer (original file unchanged). */
  showCropToolbar?: boolean;
  mimeType?: string | null;
  /** When viewing from a case, enables PDF page → stack workflows. */
  caseId?: string | null;
}) {
  return (
    <Card className="border-2 border-sky-300/70 bg-white shadow-md">
      <CardHeader className="space-y-1 px-3 pb-2 pt-3">
        <CardTitle className="text-lg font-semibold text-foreground">File view</CardTitle>
        <CardDescription className="text-xs leading-snug text-foreground/90">
          Embedded file window with zoom controls. Cropped or edited copies use a numeric suffix (e.g.{" "}
          <span className="font-mono">filename__0001.png</span>). Multi-page PDFs support per-page selection (
          <span className="font-mono">name__p0001.pdf</span>) without altering the original file.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 px-3 pb-4 pt-0">
        <EvidenceFilePreview evidenceId={evidenceId} caseId={caseId} />
        {showCropToolbar ? (
          <div className="rounded-md border border-amber-600/70 bg-amber-50/95 px-2.5 py-2">
            <p className="mb-2 text-[11px] font-semibold text-amber-950">Crop / edit (creates a new derivative)</p>
            <EvidenceRecoveryWorkflow evidenceId={evidenceId} mimeType={mimeType} integration="panel" />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
