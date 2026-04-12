import Link from "next/link";
import type { EvidenceClusterRow } from "@/services/case-investigation-query";
import type { ClusterAnalysisView } from "@/types/analysis";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EvidenceClusterBlock } from "@/components/evidence-cluster-block";

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
    <Card
      id="evidence-clusters"
      className="border-zinc-800 bg-zinc-950/80 shadow-lg ring-1 ring-zinc-800/80"
    >
      <CardHeader className="border-b border-zinc-800/90 pb-3">
        <CardTitle className="text-lg tracking-tight text-foreground">Linked Evidence Clusters</CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          Shared for this case — groupings from AI analysis that link related files. Run &quot;Analyze cluster&quot;
          for a structured review (seven finding fields plus authenticity label; linkage, corroboration, cohesion).
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-4">
        {!clusters.length ? (
          <p className="text-sm text-muted-foreground">
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
