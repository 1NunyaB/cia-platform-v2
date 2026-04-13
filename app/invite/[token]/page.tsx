import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { InviteAcceptActions } from "@/components/invite-accept-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function InviteTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const nextPath = `/invite/${encodeURIComponent(token)}`;
  const loginHref = `/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Case invitation</CardTitle>
          <CardDescription>
            Accept to join the case with the role specified in the invite. You must use the same email address the
            invitation was sent to.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <InviteAcceptActions token={token} isLoggedIn={!!user} loginHref={loginHref} />
          <p className="text-xs text-muted-foreground">
            Wrong account?{" "}
            <Link href={loginHref} className="underline">
              Switch account
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
