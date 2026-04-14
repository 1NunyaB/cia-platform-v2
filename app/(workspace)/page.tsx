import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listCasesForUser } from "@/services/case-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DatabaseSetupNotice } from "@/components/database-setup-notice";
import { DashboardHero } from "@/components/dashboard-hero";
import { WorkspaceNewCaseButton } from "@/components/workspace-new-case";
import { ArrowRight } from "lucide-react";
import { getGuestSessionIdFromCookies } from "@/lib/guest-session";

function hasSupabaseEnv(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim());
}

export default async function HomeDashboardPage() {
  const canPersist = hasSupabaseEnv();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const guestId = await getGuestSessionIdFromCookies();

  let cases: Awaited<ReturnType<typeof listCasesForUser>> = [];
  if (user && canPersist) {
    try {
      cases = await listCasesForUser(supabase, user.id);
    } catch {
      cases = [];
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10">
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
          Create case files, organize findings into standard categories, and capture notes. Sign in to track
          contributions and saved progress; data is stored in Supabase under row-level security.
        </p>
        <DashboardHero canPersist={canPersist} />
        {!canPersist ? (
          <p className="mt-4 text-xs text-muted-foreground">
            Creating investigations is disabled until Supabase environment variables are set.
          </p>
        ) : null}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 border-border/80 bg-card/80">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Recent investigations</CardTitle>
              <CardDescription>Investigations you can access, newest first.</CardDescription>
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
            ) : !user && guestId ? (
              <EmptyState title="Browsing as a guest" className="py-6">
                <div className="space-y-3">
                  <p>Open the evidence library to upload files, or sign in to see cases.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button asChild size="sm">
                      <Link href="/evidence">Evidence Library</Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/login">Sign in</Link>
                    </Button>
                  </div>
                </div>
              </EmptyState>
            ) : !user ? (
              <p className="text-sm text-muted-foreground">Sign in to see investigations you work on, or continue without an account from the home page.</p>
            ) : cases.length === 0 ? (
              <EmptyState title="No cases yet" className="py-10">
                <div className="space-y-4">
                  <p>Start with a title and a short scope — you can refine before adding real material.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <WorkspaceNewCaseButton disabled={!canPersist} />
                    <Button asChild variant="outline" disabled={!canPersist}>
                      <Link href="/cases/new">Full-page form</Link>
                    </Button>
                  </div>
                </div>
              </EmptyState>
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
              <span className="text-foreground font-medium">Evidence</span> uploads use the private{" "}
              <code className="text-xs text-foreground/80">evidence</code> storage bucket (see migration{" "}
              <code className="text-xs text-foreground/80">002_storage_evidence_bucket.sql</code>).
            </p>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
