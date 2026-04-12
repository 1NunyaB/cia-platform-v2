import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listCasesForUser } from "@/services/case-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function CasesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const cases = await listCasesForUser(supabase, user.id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Cases</h1>
          <p className="text-muted-foreground text-sm">Investigations you can access.</p>
        </div>
        <Button asChild>
          <Link href="/cases/new">New case</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your cases</CardTitle>
          <CardDescription>Select a case to open the dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          {cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No cases yet.{" "}
              <Link href="/cases/new" className="underline">
                Create your first case
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y rounded-md border">
              {cases.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <Link href={`/cases/${c.id}`} className="font-medium hover:underline">
                      {c.title}
                    </Link>
                    {c.description ? (
                      <p className="text-sm text-muted-foreground line-clamp-1">{c.description}</p>
                    ) : null}
                  </div>
                  <Badge variant="outline">{c.visibility}</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
