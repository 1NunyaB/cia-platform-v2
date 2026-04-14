import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listCasesForUser } from "@/services/case-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { getGuestSessionIdFromCookies } from "@/lib/guest-session";
import { CasesSearchFilters } from "@/components/cases-search-filters";
import { CaseRecordMetaLine } from "@/components/case-record-meta-line";
import { hasActiveCaseFilters, parseCaseListFilters } from "@/lib/case-list-filters";

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const guestId = await getGuestSessionIdFromCookies();
  const sp = await searchParams;
  const filters = parseCaseListFilters(sp);
  const filtered = hasActiveCaseFilters(filters);

  if (!user && guestId) {
    return (
      <div className="space-y-6 max-w-xl">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cases require a signed-in account. You can still use the evidence library as a guest.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Get started</CardTitle>
            <CardDescription>Create an account or sign in to create and join investigations.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/signup">Create account</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/evidence">Evidence Library</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!user) return null;

  const cases = await listCasesForUser(supabase, user.id, filters);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Cases</h1>
          <p className="mt-1 text-sm text-muted-foreground">Investigations you can access.</p>
        </div>
        <Button asChild>
          <Link href="/cases/new">New investigation</Link>
        </Button>
      </div>

      <CasesSearchFilters
        q={filters.q}
        accused={filters.accused}
        victim={filters.victim}
        state={filters.state}
        weapon={filters.weapon}
        year={filters.year != null ? String(filters.year) : ""}
      />

      <Card className="shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-foreground">Investigations</CardTitle>
          <CardDescription className="leading-relaxed text-foreground/90">
            Open a case file you created or contribute to.
            {filtered ? (
              <span className="block mt-1 font-medium text-foreground">
                Showing {cases.length} match{cases.length === 1 ? "" : "es"} with current filters.
              </span>
            ) : null}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {cases.length === 0 ? (
            <EmptyState title={filtered ? "No investigations match" : "No cases yet"}>
              <p>
                {filtered ? (
                  <>
                    Try broader terms or{" "}
                    <Link href="/cases" className="font-medium text-primary underline underline-offset-2">
                      clear filters
                    </Link>
                    .
                  </>
                ) : (
                  <>
                    <Link href="/cases/new">Start an investigation</Link>.
                  </>
                )}
              </p>
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border bg-card">
              {cases.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <Link href={`/cases/${c.id}`} className="font-medium text-foreground hover:underline">
                      {c.title}
                    </Link>
                    {c.description ? (
                      <p className="text-sm text-muted-foreground line-clamp-1">{c.description}</p>
                    ) : null}
                    <CaseRecordMetaLine caseRow={c} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
