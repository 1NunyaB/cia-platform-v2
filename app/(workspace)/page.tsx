import Link from "next/link";
import { tryCreateServiceClient } from "@/lib/supabase/service";
import { listAllCases } from "@/services/case-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { DashboardHero } from "@/components/dashboard-hero";
import { WorkspaceNewCaseButton } from "@/components/workspace-new-case";
import { ArrowRight } from "lucide-react";

export default async function HomeDashboardPage() {
  const supabase = tryCreateServiceClient();
  const canPersist = !!supabase;

  let cases: Awaited<ReturnType<typeof listAllCases>> = [];
  if (supabase) {
    try {
      cases = await listAllCases(supabase);
    } catch {
      cases = [];
    }
  }

  return (
    <div className="space-y-10">
      {!canPersist ? (
        <div className="max-w-3xl">
          <DatabaseSetupNotice />
        </div>
      ) : null}

      <section className="rounded-xl border border-border/80 bg-gradient-to-br from-card/90 to-card/40 p-8 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Investigation workspace
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Dashboard</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Create case files, organize findings into standard categories, and capture notes before real data
          arrives. This MVP runs without login; configure Supabase with a service role on the server to persist
          work.
        </p>
        <DashboardHero canPersist={canPersist} />
        {!canPersist ? (
          <p className="mt-4 text-xs text-muted-foreground">
            New case is disabled until environment variables are set.
          </p>
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/80 bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Recent cases</CardTitle>
              <CardDescription>Your investigation files, newest first.</CardDescription>
            </div>
            <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground">
              <Link href="/cases">
                View all
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!canPersist ? (
              <p className="text-sm text-muted-foreground">Connect the database to list and create cases.</p>
            ) : cases.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border/80 bg-muted/5 p-8 text-center">
                <p className="text-sm text-muted-foreground">
                  No cases yet. Start with a title and a short scope — you can refine before adding real material.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  <WorkspaceNewCaseButton disabled={!canPersist} />
                  <Button asChild variant="outline" disabled={!canPersist}>
                    <Link href="/cases/new">Full-page form</Link>
                  </Button>
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-border/60 rounded-lg border border-border/60">
                {cases.slice(0, 8).map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/cases/${c.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/10"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{c.title}</p>
                        {c.description ? (
                          <p className="text-sm text-muted-foreground line-clamp-1">{c.description}</p>
                        ) : null}
                      </div>
                      <Badge variant="secondary" className="shrink-0 capitalize">
                        {c.visibility}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/80 bg-card/80">
          <CardHeader>
            <CardTitle className="text-base">Workspace</CardTitle>
            <CardDescription>Built for a serious review posture.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="text-foreground font-medium">Cases</span> hold overview, category buckets, evidence
              placeholders, and notes.
            </p>
            <p>
              <span className="text-foreground font-medium">Categories</span> use fixed labels so future analysis
              and manual entry stay aligned.
            </p>
            <p>
              <span className="text-foreground font-medium">Evidence</span> uploads require a configured Supabase
              storage bucket and migration <code className="text-xs text-foreground/80">003</code>.
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
