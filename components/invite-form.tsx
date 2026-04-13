"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import type { CaseMemberRole } from "@/types";

export function InviteForm({ caseId }: { caseId: string }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CaseMemberRole>("contributor");
  const [loading, setLoading] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviteUrl(null);
    setInviteToken(null);
    setLoading(true);
    const res = await fetch(`/api/cases/${caseId}/invites`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError((data as { error?: string }).error ?? "Invite failed");
      return;
    }
    setInviteUrl((data as { inviteUrl?: string | null }).inviteUrl ?? null);
    setInviteToken((data as { token?: string }).token ?? null);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 max-w-md">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as CaseMemberRole)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="viewer">Viewer</SelectItem>
              <SelectItem value="contributor">Contributor</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="owner">Owner</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      {inviteUrl ? (
        <Alert>
          <AlertTitle>Invite created</AlertTitle>
          <AlertDescription className="break-all text-xs">
            Share this link with the invitee (they must log in with the same email): {inviteUrl}
          </AlertDescription>
        </Alert>
      ) : inviteToken ? (
        <Alert>
          <AlertTitle>Invite created</AlertTitle>
          <AlertDescription className="break-all text-xs">
            Token (set NEXT_PUBLIC_SITE_URL or use from same origin): {inviteToken}
          </AlertDescription>
        </Alert>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Recipients open <code className="text-[10px]">/invite/&lt;token&gt;</code>, sign in with the invited email,
        and accept (see migration <code className="text-[10px]">026_accept_case_invite_rpc.sql</code>).
      </p>
      <Button type="submit" disabled={loading}>
        {loading ? "Sending…" : "Create invite"}
      </Button>
    </form>
  );
}
