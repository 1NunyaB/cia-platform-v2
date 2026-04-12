"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
      <Button type="button" onClick={() => void run()} disabled={loading}>
        {loading ? "Running AI…" : "Run AI analysis"}
      </Button>
    </div>
  );
}
