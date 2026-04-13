"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

type Props = {
  /** Where to navigate after the guest session cookie is set. */
  nextHref?: string;
  label?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  className?: string;
};

/**
 * POST /api/guest/session then full navigation so the HttpOnly cookie is sent on the next request.
 */
export function ContinueAsGuestButton({
  nextHref = "/dashboard",
  label = "Continue without account",
  variant = "outline",
  className,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/guest/session", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not start a guest session.");
        setLoading(false);
        return;
      }
      window.location.assign(nextHref);
    } catch {
      setError("Network error.");
    }
    setLoading(false);
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant={variant} className={className} disabled={loading} onClick={onClick}>
        {loading ? "Starting…" : label}
      </Button>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
