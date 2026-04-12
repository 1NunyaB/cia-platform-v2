"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AssignEvidenceToCase({
  evidenceId,
  cases,
}: {
  evidenceId: string;
  cases: { id: string; title: string }[];
}) {
  const router = useRouter();
  const [caseId, setCaseId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!caseId) {
      setError("Choose a case.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/evidence/${evidenceId}/assign-case`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Could not assign to case.");
        return;
      }
      router.push(`/cases/${caseId}/evidence/${evidenceId}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (cases.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Create a case first, then you can attach this file from the dropdown above.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1 space-y-1">
          <label className="text-xs text-muted-foreground">Add to case</label>
          <Select value={caseId} onValueChange={setCaseId}>
            <SelectTrigger className="bg-zinc-950 border-zinc-700">
              <SelectValue placeholder="Select a case…" />
            </SelectTrigger>
            <SelectContent>
              {cases.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" size="sm" disabled={loading || !caseId} onClick={() => void submit()}>
          {loading ? "Assigning…" : "Assign"}
        </Button>
      </div>
      {error ? <p className="text-xs text-red-400">{error}</p> : null}
    </div>
  );
}
