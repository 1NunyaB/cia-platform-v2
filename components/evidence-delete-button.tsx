"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function EvidenceDeleteButton({
  evidenceId,
  redirectTo,
}: {
  evidenceId: string;
  redirectTo: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    const code = window.prompt("Enter admin confirmation code");
    if (!code) return;
    const confirmDelete = window.confirm("Delete this evidence record and its stored file?");
    if (!confirmDelete) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/evidence/${evidenceId}`, {
      method: "DELETE",
      headers: { "x-admin-confirm-code": code.trim() },
    });
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setPending(false);
    if (!res.ok) {
      setError(data.error ?? "Delete failed.");
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="space-y-1">
      <Button
        type="button"
        variant="outline"
        className="border-red-400 bg-red-50 text-red-900 hover:bg-red-100"
        disabled={pending}
        onClick={() => void onDelete()}
      >
        {pending ? "Deleting…" : "Delete evidence"}
      </Button>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
