import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listPublicCases } from "@/services/case-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export default async function ExplorePage() {
  const supabase = await createClient();
  const cases = await listPublicCases(supabase);

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Browse investigations</h1>
        <p className="mt-1 text-sm leading-relaxed text-foreground">
          Investigations listed here are visible inside this app according to access rules. To add <strong className="font-semibold">case</strong> notes, comments, or evidence <strong className="font-semibold">attached to a case</strong>, you need to sign in — those writes go through Row Level Security and are attributed to your account. Guests may still upload to the evidence library when that flow is enabled.
        </p>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="space-y-1">
          <CardTitle className="text-foreground">Directory</CardTitle>
          <CardDescription className="leading-relaxed">Recently updated investigations.</CardDescription>
        </CardHeader>
        <CardContent>
          {cases.length === 0 ? (
            <EmptyState title="No public investigations yet">
              <p>Check back later, or sign in to create your own.</p>
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border bg-card">
              {cases.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <Link href={`/cases/${c.id}`} className="font-medium text-foreground hover:underline">
                      {c.title}
                    </Link>
                    {c.description ? (
                      <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>
                    ) : null}
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
