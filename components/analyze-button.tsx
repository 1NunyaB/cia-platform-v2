"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InvestigationLoadingIndicator } from "@/components/investigation-loading-indicator";

export function AnalyzeButton({
  evidenceId,
  label = "Run AI analysis",
  disabled = false,
  disabledHint = "File must be ready to view before analysis.",
  className,
  onBusyChange,
}: {
  evidenceId: string;
  label?: string;
  disabled?: boolean;
  disabledHint?: string;
  className?: string;
  /** Fires when AI analysis request starts/finishes (for unified status UI). */
  onBusyChange?: (busy: boolean) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onBusyChange?.(loading);
  }, [loading, onBusyChange]);

  async function run() {
    setError(null);
    setLoading(true);
    const res = await fetch(`/api/evidence/${evidenceId}/analyze`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError((data as { error?: string }).error ?? "Analysis failed");
      return;
    }
    router.refresh();
  }

  const busyClass =
    "bg-sky-700 text-white hover:bg-sky-600 disabled:bg-sky-700 disabled:text-white disabled:opacity-60";

  return (
    <div className="inline-flex flex-col gap-1">
      {error ? (
        <Alert variant="destructive" className="max-w-xs py-2">
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        type="button"
        onClick={() => void run()}
        disabled={loading || disabled}
        title={disabled ? disabledHint : undefined}
        className={busyClass + (className ? ` ${className}` : "")}
        size="sm"
      >
        {loading ? <InvestigationLoadingIndicator inline label="Running AI…" /> : label}
      </Button>
    </div>
  );
}
