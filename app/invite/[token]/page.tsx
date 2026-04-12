import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * TODO: Accept invite flow — verify logged-in user email matches case_invites.email,
 * insert case_members with role, set accepted_at. May require RPC with SECURITY DEFINER
 * or service role to read invite by token.
 */
export default function InviteTokenPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <Card className="max-w-md">
        <CardHeader>
          <CardTitle>Invite</CardTitle>
          <CardDescription>
            Invite acceptance is not wired in this scaffold. Implement token validation and membership insert in a
            server action or route handler.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            See <code className="text-xs">case_invites</code> table and{" "}
            <code className="text-xs">InviteForm</code> for context.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
