"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { InvestigationLoadingIndicator } from "@/components/investigation-loading-indicator";

export function RunEvidenceExtractionButton({
  evidenceId,
  force = false,
  label = "Run extraction",
  variant = "default",
}: {
  evidenceId: string;
  force?: boolean;
  label?: string;
  variant?: "default" | "secondary" | "outline";
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const actionClass =
    variant === "outline"
      ? "border-sky-500 bg-sky-100 text-slate-900 hover:bg-sky-200 disabled:bg-sky-100 disabled:text-slate-900"
      : "bg-sky-700 text-white hover:bg-sky-600 disabled:bg-sky-700 disabled:text-white";

  return (
    <Button
      type="button"
      variant={variant}
      className={actionClass}
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await fetch(`/api/evidence/${evidenceId}/extract`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ force }),
          });
          router.refresh();
        } finally {
          setPending(false);
        }
      }}
    >
      {pending ? <InvestigationLoadingIndicator inline label="Running..." /> : label}
    </Button>
  );
}
