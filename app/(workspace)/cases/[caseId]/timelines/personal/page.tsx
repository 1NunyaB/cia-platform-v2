import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCaseById } from "@/services/case-service";
import { listAnalystInteractionTimeline } from "@/services/interaction-timeline-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const ACTION_LABELS: Record<string, string> = {
  "evidence.opened": "Opened evidence",
  "evidence.compared": "Compared evidence",
  "evidence.extract": "Prepared evidence for analysis",
  "evidence.analyze": "Ran analysis",
  "cluster.viewed": "Viewed full cluster",
  "timeline.drilldown": "Used timeline drilldown",
};

function labelForAction(action: string): string {
  if (ACTION_LABELS[action]) return ACTION_LABELS[action];
  if (action.startsWith("case.note")) return "Added/updated case note";
  if (action.startsWith("comment.")) return "Added comment";
  if (action.startsWith("sticky.")) return "Worked with sticky notes";
  if (action.startsWith("evidence.")) return action.replace("evidence.", "Evidence: ");
  return action;
}

export default async function PersonalInteractionTimelinePage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) notFound();

  const c = await getCaseById(supabase, caseId);
  if (!c) notFound();

  const events = await listAnalystInteractionTimeline(supabase, {
    caseId,
    actorId: user.id,
    limit: 1200,
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/cases/${caseId}/timelines`} className="hover:underline">
            ← Timelines hub
          </Link>
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Analyst interaction timeline</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Personal work timeline for this case. Separate from Confirmed / Supported / Leads factual timelines.
        </p>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground">Your interaction events</CardTitle>
          <CardDescription>
            Evidence opens, compare actions, analysis runs, cluster views, note/comment actions, and timeline drilldowns
            are recorded here.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!events.length ? (
            <p className="text-sm text-muted-foreground">No interaction events yet for this case.</p>
          ) : (
            <ul className="space-y-2">
              {events.map((ev) => (
                <li key={ev.id} className="rounded-md border border-border bg-panel px-3 py-2">
                  <p className="text-sm font-medium text-foreground">{labelForAction(ev.action)}</p>
                  <p className="text-xs text-muted-foreground">{new Date(ev.created_at).toLocaleString()}</p>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

