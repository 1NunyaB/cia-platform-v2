import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listEvidenceClustersForCase } from "@/services/case-investigation-query";
import { listClusterAnalysesForCase } from "@/services/collaboration-service";
import { logActivity } from "@/services/activity-service";
import { EvidenceClusterBlock } from "@/components/evidence-cluster-block";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function ClusterDetailPage({
  params,
}: {
  params: Promise<{ caseId: string; clusterId: string }>;
}) {
  const { caseId, clusterId } = await params;
  const supabase = await createClient();

  const [clusters, analyses] = await Promise.all([
    listEvidenceClustersForCase(supabase, caseId),
    listClusterAnalysesForCase(supabase, caseId),
  ]);
  const cluster = clusters.find((c) => c.id === clusterId);
  if (!cluster) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    try {
      await logActivity(supabase, {
        caseId,
        actorId: user.id,
        actorLabel: "Analyst",
        action: "cluster.viewed",
        entityType: "evidence_cluster",
        entityId: clusterId,
        payload: {},
      });
    } catch {
      /* non-blocking */
    }
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/cases/${caseId}`} className="hover:underline">
            ← Case
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Cluster detail</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Full cluster context with linked evidence and cluster analysis for this case.
        </p>
      </div>
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base text-foreground">{cluster.title ?? "Untitled cluster"}</CardTitle>
          <CardDescription>Open each linked evidence file or run/update cluster analysis.</CardDescription>
        </CardHeader>
        <CardContent>
          <EvidenceClusterBlock
            caseId={caseId}
            cluster={cluster}
            initialAnalysis={analyses[cluster.id] ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}

