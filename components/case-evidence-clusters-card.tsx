import Link from "next/link";
import type { EvidenceClusterRow } from "@/services/case-investigation-query";
import type { ClusterAnalysisView } from "@/types/analysis";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EvidenceClusterBlock } from "@/components/evidence-cluster-block";
import { cisCasePage } from "@/lib/cis-case-page-shell";
import { cn } from "@/lib/utils";

export function CaseEvidenceClustersCard({
  caseId,
  clusters,
  analysisByClusterId = {},
}: {
  caseId: string;
  clusters: EvidenceClusterRow[];
  analysisByClusterId?: Record<string, ClusterAnalysisView>;
}) {
  return (
    <Card id="evidence-clusters" className={cn(cisCasePage.panel)}>
      <CardHeader className={cn("pb-3", cisCasePage.panelHeaderBorder)}>
        <CardTitle className={cn(cisCasePage.cardTitle, "text-lg")}>Linked Evidence Clusters</CardTitle>
        <CardDescription className={cn(cisCasePage.cardDescription, "text-sm")}>
          Shared for this case — groupings from AI analysis that link related files. Run &quot;Analyze cluster&quot;
          for a structured review (seven finding fields plus authenticity label; linkage, corroboration, cohesion).
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {!clusters.length ? (
          <p className="text-sm text-slate-500">
            No linked clusters yet. Run AI analysis on evidence files; when the model proposes clusters, they
            appear here for everyone on this case.
          </p>
        ) : (
          <ul className="space-y-4">
            {clusters.map((cl) => (
              <EvidenceClusterBlock
                key={cl.id}
                caseId={caseId}
                cluster={cl}
                initialAnalysis={analysisByClusterId[cl.id] ?? null}
              />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
