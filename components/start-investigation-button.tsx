"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function StartInvestigationButton({ caseId, disabled = false }: { caseId: string; disabled?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  return (
    <Button
      type="button"
      size="sm"
      className="h-8"
      disabled={disabled || loading}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/cases/${caseId}/start`, {
            method: "POST",
            credentials: "include",
          });
          if (res.ok) {
            router.refresh();
            return;
          }
        } finally {
          setLoading(false);
        }
      }}
    >
      {loading ? (
        <>
          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
          Starting...
        </>
      ) : (
        "Start Investigation"
      )}
    </Button>
  );
}

