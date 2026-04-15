"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PutOnHoldButton({ caseId, disabled = false }: { caseId: string; disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  return (
    <div className="space-y-1">
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8"
        disabled={disabled || loading}
        onClick={async () => {
          setLoading(true);
          setMessage(null);
          try {
            const res = await fetch(`/api/cases/${caseId}/hold`, {
              method: "POST",
              credentials: "include",
            });
            const data = (await res.json().catch(() => ({}))) as { message?: string; error?: string };
            if (res.ok) {
              setMessage(data.message ?? "Updated.");
              router.refresh();
              return;
            }
            setMessage(data.error ?? "Could not update hold status.");
          } finally {
            setLoading(false);
          }
        }}
      >
        {loading ? (
          <>
            <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
            Updating...
          </>
        ) : (
          "Put on Hold"
        )}
      </Button>
      {message ? <p className="max-w-[18rem] text-[10px] text-muted-foreground">{message}</p> : null}
    </div>
  );
}

