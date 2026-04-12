import Link from "next/link";
import { AnalysisFindingPanel } from "@/components/analysis-finding-panel";
import {
  CLUSTER_AUTO_LINK_MIN_SIGNALS,
  CLUSTER_AUTO_LINK_SCORE_THRESHOLD,
  CLUSTER_MENTION_SCORE_THRESHOLD,
  CLUSTER_RECOMMEND_SCORE_THRESHOLD,
} from "@/lib/evidence-intelligence-thresholds";
import type { EvidenceIntelligenceResult } from "@/types/evidence-intelligence";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function EvidenceIntelligencePanel({
  caseId,
  intelligence,
}: {
  caseId: string;
  intelligence: EvidenceIntelligenceResult;
}) {
  const { finding, existingClusters, suggestions, autoLinked, collaboration } = intelligence;

  const recommended = suggestions.filter((s) => !s.autoLinked && (s.tier === "high" || s.tier === "medium"));
  const weakLeads = suggestions.filter((s) => !s.autoLinked && s.tier === "low");

  return (
    <Card className="border-zinc-800 bg-zinc-950/80 shadow-lg ring-1 ring-zinc-800/80">
      <CardHeader className="border-b border-zinc-800/90 pb-3">
        <CardTitle className="text-lg tracking-tight">Evidence intelligence (on open)</CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          Automatic correlation check across clusters, entities, links, and collaboration signals. Structured advisory
          uses the same seven-field format; cluster placement uses transparent score thresholds (not a separate
          analysis run).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 pt-4">
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2">Why this matters</h3>
          <p className="text-sm text-muted-foreground">
            Opening this file triggers a case-scoped pass: who else has viewed it, whether notes or discussion exist,
            how it ties to entities and timeline rows, and whether it overlaps clusters or cross-evidence links.
            Suggested clusters are ranked by shared entity labels, explicit links to cluster members, and lexical
            overlap with cluster text (cautious; see limitations in the finding).
          </p>
        </div>

        <AnalysisFindingPanel finding={finding} />

        <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 text-xs text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">Threshold logic (heuristic scores 0–1)</p>
          <ul className="list-disc pl-4 space-y-1">
            <li>
              <strong className="text-foreground">Auto-link</strong>: score ≥ {CLUSTER_AUTO_LINK_SCORE_THRESHOLD} and at
              least {CLUSTER_AUTO_LINK_MIN_SIGNALS} independent signals (e.g. shared entity + link, or entity + lexical
              overlap). Inserts a cluster membership row and logs{" "}
              <code className="text-[11px]">evidence.cluster_auto_linked</code> in activity.
            </li>
            <li>
              <strong className="text-foreground">Recommend</strong>: score ≥ {CLUSTER_RECOMMEND_SCORE_THRESHOLD} — show
              as suggested linkage; no automatic membership.
            </li>
            <li>
              <strong className="text-foreground">Possible lead</strong>: score ≥ {CLUSTER_MENTION_SCORE_THRESHOLD} —
              surfaced only as a weak exploratory hint.
            </li>
          </ul>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-md border border-zinc-800 p-3 text-sm">
            <h4 className="font-medium text-foreground mb-2">Collaboration snapshot</h4>
            <ul className="text-muted-foreground space-y-1 text-xs">
              <li>Open events logged: {collaboration.openEventCount}</li>
              <li>Distinct viewers (by session key): {collaboration.distinctViewerCount}</li>
              {collaboration.viewerNames.length > 0 ? (
                <li>Named profiles: {collaboration.viewerNames.join(", ")}</li>
              ) : null}
              <li>Sticky notes: {collaboration.hasStickies ? "yes" : "no"}</li>
              <li>Threaded comments: {collaboration.hasComments ? "yes" : "no"}</li>
              <li>Formal file notes: {collaboration.hasFormalNotes ? "yes" : "no"}</li>
              <li>Entity ties (this file): {collaboration.entityMentionCount}</li>
              <li>Timeline links: {collaboration.timelineEventLinkCount}</li>
              <li>Cross-evidence links: {collaboration.crossEvidenceLinkCount}</li>
            </ul>
          </div>
          <div className="rounded-md border border-zinc-800 p-3 text-sm">
            <h4 className="font-medium text-foreground mb-2">Cluster links (current)</h4>
            {existingClusters.length === 0 ? (
              <p className="text-xs text-muted-foreground">Not linked to a cluster yet (unless just auto-linked above).</p>
            ) : (
              <ul className="space-y-2 text-xs">
                {existingClusters.map((c) => (
                  <li key={c.id}>
                    <span className="text-foreground font-medium">{c.title ?? "Cluster"}</span>
                    {c.rationale ? (
                      <p className="text-muted-foreground mt-0.5 line-clamp-3">{c.rationale}</p>
                    ) : null}
                    <Link
                      href={`/cases/${caseId}#evidence-clusters`}
                      className="text-sky-400 hover:underline mt-1 inline-block"
                    >
                      View on case page
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {autoLinked.length > 0 ? (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-950/20 p-3 text-sm">
            <h4 className="font-medium text-emerald-200 mb-1">Automatic cluster placement (this open)</h4>
            <ul className="space-y-2 text-xs text-muted-foreground">
              {autoLinked.map((a) => (
                <li key={a.clusterId}>
                  <strong className="text-foreground">{a.title ?? a.clusterId}</strong> — score{" "}
                  {(a.score * 100).toFixed(0)}%. {a.rationale}
                </li>
              ))}
            </ul>
            <p className="text-[11px] text-muted-foreground mt-2">
              Logged as <code className="text-emerald-200/90">evidence.cluster_auto_linked</code> in case activity.
            </p>
          </div>
        ) : null}

        {recommended.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Suggested clusters (review recommended)</h4>
            <ul className="space-y-3 text-sm">
              {recommended.map((s) => (
                <li key={s.clusterId} className="rounded-md border border-zinc-800 bg-zinc-950/40 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-foreground">{s.title ?? "Cluster"}</span>
                    <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                      {(s.score * 100).toFixed(0)}% · {s.tier}
                    </span>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground list-disc pl-4">
                    {s.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                  <Link
                    href={`/cases/${caseId}#evidence-clusters`}
                    className="text-xs text-sky-400 hover:underline mt-2 inline-block"
                  >
                    Review on case page — membership stays shared for all analysts
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {weakLeads.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-foreground">Possible related leads (low confidence)</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              {weakLeads.map((s) => (
                <li key={s.clusterId}>
                  {s.title ?? s.clusterId} — {(s.score * 100).toFixed(0)}%
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
