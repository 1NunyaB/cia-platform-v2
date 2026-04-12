import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listPublicCases } from "@/services/case-service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ExplorePage() {
  const supabase = await createClient();
  const cases = await listPublicCases(supabase);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Public cases</h1>
        <p className="text-muted-foreground text-sm">
          Browse cases marked public. You can add notes and comments as a signed-in user.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Directory</CardTitle>
          <CardDescription>Recently updated public investigations.</CardDescription>
        </CardHeader>
        <CardContent>
          {cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">No public cases yet.</p>
          ) : (
            <ul className="divide-y rounded-md border">
              {cases.map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-4 p-4">
                  <div>
                    <Link href={`/cases/${c.id}`} className="font-medium hover:underline">
                      {c.title}
                    </Link>
                    {c.description ? (
                      <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>
                    ) : null}
                  </div>
                  <Badge>public</Badge>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
