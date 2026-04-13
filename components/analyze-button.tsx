"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { InvestigationLoadingIndicator } from "@/components/investigation-loading-indicator";

export function AnalyzeButton({ evidenceId }: { evidenceId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-2">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button
        type="button"
        onClick={() => void run()}
        disabled={loading}
        className="bg-sky-700 text-white hover:bg-sky-600 disabled:bg-sky-700 disabled:text-white"
      >
        {loading ? <InvestigationLoadingIndicator inline label="Running AI..." /> : "Run AI analysis"}
      </Button>
    </div>
  );
}
