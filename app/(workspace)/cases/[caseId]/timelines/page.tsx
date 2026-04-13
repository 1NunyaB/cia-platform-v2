import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCaseById } from "@/services/case-service";
import { normalizeTimelineKind } from "@/lib/timeline-kind-schema";
import type { TimelineKind, TimelineTier } from "@/types/analysis";
import { TIMELINE_KIND_LABELS, TIMELINE_TIER_LABELS } from "@/types/analysis";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Row = {
  id: string;
  occurred_at: string | null;
  timeline_kind: TimelineKind | null;
  timeline_tier: TimelineTier | null;
  custom_lane_label: string | null;
  evidence_file_id: string | null;
  updated_at: string | null;
};

function isoWeekKey(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

export default async function CaseTimelinesHubPage({
  params,
}: {
  params: Promise<{ caseId: string }>;
}) {
  const { caseId } = await params;
  const supabase = await createClient();

  const c = await getCaseById(supabase, caseId);
  if (!c) notFound();

  const { data, error } = await supabase
    .from("timeline_events")
    .select("id, occurred_at, timeline_kind, timeline_tier, custom_lane_label, evidence_file_id, updated_at")
    .eq("case_id", caseId)
    .order("occurred_at", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as Row[];
  const byKind = new Map<string, Row[]>();
  for (const r of rows) {
    const kind = normalizeTimelineKind(r.timeline_kind);
    const key = kind === "custom" ? `custom:${(r.custom_lane_label ?? "").trim() || "Custom Timeline"}` : kind;
    const arr = byKind.get(key) ?? [];
    arr.push(r);
    byKind.set(key, arr);
  }

  const cards = [...byKind.entries()].map(([key, list]) => {
    const isCustom = key.startsWith("custom:");
    const kind = isCustom ? "custom" : (key as TimelineKind);
    const label = isCustom ? key.slice("custom:".length) : TIMELINE_KIND_LABELS[kind];
    const tierCounts = list.reduce<Record<TimelineTier, number>>(
      (acc, r) => {
        const t = (r.timeline_tier ?? "t3_leads") as TimelineTier;
        acc[t] = (acc[t] ?? 0) + 1;
        return acc;
      },
      { t1_confirmed: 0, t2_supported: 0, t3_leads: 0 },
    );
    const evidenceCount = new Set(list.map((r) => r.evidence_file_id).filter(Boolean)).size;
    const latest = list
      .map((r) => r.updated_at ?? r.occurred_at)
      .filter(Boolean)
      .sort()
      .at(-1);
    const href = isCustom
      ? `/cases/${caseId}/timeline?kind=custom&customLane=${encodeURIComponent(label)}`
      : `/cases/${caseId}/timeline?kind=${kind}`;
    return { key, kind, label, total: list.length, tierCounts, evidenceCount, latest, href };
  });

  const years = new Map<string, number>();
  const months = new Map<string, number>();
  const weeks = new Map<string, number>();
  for (const r of rows) {
    if (!r.occurred_at) continue;
    const dt = new Date(r.occurred_at);
    if (Number.isNaN(dt.getTime())) continue;
    const y = String(dt.getFullYear());
    const m = `${y}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
    const w = isoWeekKey(dt);
    years.set(y, (years.get(y) ?? 0) + 1);
    months.set(m, (months.get(m) ?? 0) + 1);
    weeks.set(w, (weeks.get(w) ?? 0) + 1);
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/cases/${caseId}`} className="hover:underline">
              ← Case
            </Link>
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">Timelines hub</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Browse all timeline perspectives for this case, then open a lane to work in view/theory/research modes.
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href={`/cases/${caseId}/timeline`}>Open main timeline workspace</Link>
        </Button>
      </div>

      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground">Alternate timeline</CardTitle>
          <CardDescription>
            Personal work timeline is separate from factual timeline tiers and perspectives.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm">
            <Link href={`/cases/${caseId}/timelines/personal`}>Open Analyst interaction timeline</Link>
          </Button>
        </CardContent>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {cards.length === 0 ? (
          <Card className="md:col-span-2 xl:col-span-3 border-border bg-card">
            <CardContent className="pt-6 text-sm text-muted-foreground">
              No timeline events yet for this case.
            </CardContent>
          </Card>
        ) : (
          cards.map((cRow) => (
            <Card key={cRow.key} className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-foreground">{cRow.label}</CardTitle>
                <CardDescription>
                  {cRow.kind === "witness" && "Witness timeline(s)"}
                  {cRow.kind === "subject_actor" && "Target / suspect timeline"}
                  {cRow.kind === "official" && "Authority / provided timeline"}
                  {cRow.kind === "evidence" && "Evidence-grounded timeline"}
                  {cRow.kind === "reconstructed" && "Reconstructed / closest-known factual timeline"}
                  {cRow.kind === "custom" && "Custom perspective timeline"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="text-foreground">
                  <span className="font-medium">{cRow.total}</span> items · <span className="font-medium">{cRow.evidenceCount}</span>{" "}
                  linked evidence
                </p>
                <p className="text-muted-foreground text-xs">
                  Confirmed: {cRow.tierCounts.t1_confirmed} · Supported: {cRow.tierCounts.t2_supported} · Leads:{" "}
                  {cRow.tierCounts.t3_leads}
                </p>
                <p className="text-muted-foreground text-xs">
                  Last updated: {cRow.latest ? new Date(cRow.latest).toLocaleString() : "N/A"}
                </p>
                <Button asChild size="sm" className="mt-1">
                  <Link href={cRow.href}>Open timeline</Link>
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">Timeline drilldown</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Jump into years, months, or weeks. Links use date filters in the timeline workspace.
        </p>
        <div className="mt-3 grid gap-4 lg:grid-cols-3">
          <DrilldownList
            title="Years"
            entries={[...years.entries()].sort((a, b) => b[0].localeCompare(a[0]))}
            href={(k) => `/cases/${caseId}/timeline?year=${encodeURIComponent(k)}`}
          />
          <DrilldownList
            title="Months"
            entries={[...months.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 18)}
            href={(k) => `/cases/${caseId}/timeline?month=${encodeURIComponent(k)}`}
          />
          <DrilldownList
            title="Weeks"
            entries={[...weeks.entries()].sort((a, b) => b[0].localeCompare(a[0])).slice(0, 18)}
            href={(k) => `/cases/${caseId}/timeline?week=${encodeURIComponent(k)}`}
          />
        </div>
      </section>
    </div>
  );
}

function DrilldownList({
  title,
  entries,
  href,
}: {
  title: string;
  entries: [string, number][];
  href: (key: string) => string;
}) {
  return (
    <div className="rounded-md border border-border bg-panel p-3">
      <h3 className="text-sm font-medium text-foreground">{title}</h3>
      {entries.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">No dated events.</p>
      ) : (
        <ul className="mt-2 space-y-1.5 text-sm">
          {entries.map(([key, count]) => (
            <li key={key} className="flex items-center justify-between gap-2">
              <Link href={href(key)} className="text-blue-800 hover:underline">
                {key}
              </Link>
              <span className="text-xs text-muted-foreground">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

