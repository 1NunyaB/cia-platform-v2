"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function StartInvestigationButton({
  caseId,
  disabled = false,
  className,
}: {
  caseId: string;
  disabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  return (
    <Button
      type="button"
      size="sm"
      className={cn("h-8", className)}
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

