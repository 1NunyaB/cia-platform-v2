"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function InviteAcceptActions({
  token,
  isLoggedIn,
  loginHref,
}: {
  token: string;
  isLoggedIn: boolean;
  loginHref: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/invites/${encodeURIComponent(token)}/accept`, {
        method: "POST",
        credentials: "same-origin",
      });
      const json = (await res.json()) as { case_id?: string; error?: string };
      if (!res.ok) {
        setError(json.error ?? "Could not accept invite");
        return;
      }
      if (json.case_id) {
        router.push(`/cases/${json.case_id}`);
        router.refresh();
        return;
      }
      setError("Unexpected response");
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (!isLoggedIn) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Sign in with the email address that received the invitation, then return here to accept.
        </p>
        <Button asChild>
          <Link href={loginHref}>Sign in to continue</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="button" onClick={() => void accept()} disabled={loading}>
        {loading ? "Accepting…" : "Accept invitation"}
      </Button>
    </div>
  );
}
