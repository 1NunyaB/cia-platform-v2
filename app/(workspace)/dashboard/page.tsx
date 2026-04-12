import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { listCasesForUser } from "@/services/case-service";
import { listRecentDashboardChat } from "@/services/collaboration-service";
import { fetchProfilesByIds } from "@/lib/profiles";
import { DashboardChat } from "@/components/dashboard-chat";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  let cases: Awaited<ReturnType<typeof listCasesForUser>> = [];
  try {
    cases = await listCasesForUser(supabase, user.id);
  } catch {
    cases = [];
  }

  let chatMessages: Awaited<ReturnType<typeof listRecentDashboardChat>> = [];
  try {
    chatMessages = await listRecentDashboardChat(supabase, 80);
  } catch {
    chatMessages = [];
  }

  const chatAuthorIds = [...new Set(chatMessages.map((m) => m.author_id).filter(Boolean))] as string[];
  const chatProfiles = await fetchProfilesByIds(supabase, chatAuthorIds);
  const profileNames = Object.fromEntries(
    chatAuthorIds.map((id) => [id, chatProfiles[id]?.display_name ?? id]),
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm">Your cases and quick actions.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <Link href="/evidence">Evidence database</Link>
          </Button>
          <Button asChild>
            <Link href="/cases/new">New case</Link>
          </Button>
        </div>
      </div>

      <Card className="border-zinc-800 bg-zinc-950/50">
        <CardHeader>
          <CardTitle className="text-base">Upload without opening a case</CardTitle>
          <CardDescription>
            Add files to the master evidence database first, then attach them to a case when you are ready. Case
            uploads stay available inside each case workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild size="sm">
            <Link href="/evidence">Open evidence library</Link>
          </Button>
        </CardContent>
      </Card>

      <DashboardChat initialMessages={chatMessages} profileNames={profileNames} />

      <Card>
        <CardHeader>
          <CardTitle>Recent cases</CardTitle>
          <CardDescription>Cases you belong to.</CardDescription>
        </CardHeader>
        <CardContent>
          {cases.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No cases yet.{" "}
              <Link href="/cases/new" className="underline">
                Create one
              </Link>{" "}
              or browse{" "}
              <Link href="/explore" className="underline">
                public cases
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2">
              {cases.slice(0, 8).map((c) => (
                <li key={c.id}>
                  <Link href={`/cases/${c.id}`} className="font-medium hover:underline">
                    {c.title}
                  </Link>
                  <span className="text-muted-foreground text-sm ml-2">({c.visibility})</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
