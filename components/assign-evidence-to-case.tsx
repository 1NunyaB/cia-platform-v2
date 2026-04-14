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
  layout = "default",
}: {
  evidenceId: string;
  cases: { id: string; title: string }[];
  /** `toolbar`: single row for Evidence processing action bar. */
  layout?: "default" | "toolbar";
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
        setError(data.error ?? "Could not add to case.");
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
      <p className="text-xs text-foreground">
        Create an investigation first, then you can attach this file from the dropdown above (in-app only).
      </p>
    );
  }

  if (layout === "toolbar") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <Select value={caseId} onValueChange={setCaseId}>
          <SelectTrigger className="h-8 w-[min(220px,100%)] border-sky-400/80 bg-white text-xs text-foreground">
            <SelectValue placeholder="Select case…" />
          </SelectTrigger>
          <SelectContent>
            {cases.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-8 border-sky-500 bg-sky-50 text-foreground hover:bg-sky-100"
          disabled={loading || !caseId}
          onClick={() => void submit()}
        >
          {loading ? "Adding…" : "Add to case"}
        </Button>
        {error ? <p className="w-full text-xs font-medium text-red-900">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1 space-y-1">
          <label className="text-xs font-medium text-foreground">Add to case</label>
          <Select value={caseId} onValueChange={setCaseId}>
            <SelectTrigger>
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
          {loading ? "Adding…" : "Add to case"}
        </Button>
      </div>
      {error ? <p className="text-xs text-alert-foreground">{error}</p> : null}
    </div>
  );
}
