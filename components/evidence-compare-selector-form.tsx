"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export type EvidenceCompareOption = {
  id: string;
  label: string;
  searchText: string;
};

export function EvidenceCompareSelectorForm({
  options,
  initialA = "",
  initialB = "",
}: {
  options: EvidenceCompareOption[];
  initialA?: string;
  initialB?: string;
}) {
  const [query, setQuery] = useState("");
  const [selectedA, setSelectedA] = useState(initialA);
  const [selectedB, setSelectedB] = useState(initialB);

  const filteredOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((opt) => opt.searchText.includes(q));
  }, [options, query]);

  const duplicateSelection = selectedA !== "" && selectedA === selectedB;
  const canCompare = selectedA !== "" && selectedB !== "" && !duplicateSelection;

  const fieldClass =
    "h-10 w-full rounded-lg border border-[#1e2d42] bg-[#0f1623] px-3 text-sm text-[#e2e8f0] shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-sky-500/50";

  return (
    <form
      method="get"
      action="/evidence/compare"
      className="space-y-4 rounded-xl border p-4"
      style={{ backgroundColor: "#141e2e", borderColor: "#1e2d42" }}
    >
      <div className="space-y-2">
        <Label htmlFor="cmp-search" className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Search evidence
        </Label>
        <Input
          id="cmp-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by filename, alias, type, or case…"
          className={cn(
            "h-9 border-[#1e2d42] bg-[#0f1623] text-[#e2e8f0] shadow-none placeholder:text-[#64748b] focus-visible:ring-sky-500/50",
          )}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cmp-a" className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          First evidence
        </Label>
        <select
          id="cmp-a"
          name="a"
          value={selectedA}
          onChange={(e) => setSelectedA(e.target.value)}
          className={fieldClass}
          required
        >
          <option value="">Select first file…</option>
          {filteredOptions.map((opt) => (
            <option key={`a-${opt.id}`} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-3 py-0.5">
        <div className="h-px flex-1" style={{ backgroundColor: "#263347" }} />
        <span
          className="shrink-0 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest"
          style={{ borderColor: "#334155", backgroundColor: "#1a2335", color: "#64748b" }}
        >
          vs
        </span>
        <div className="h-px flex-1" style={{ backgroundColor: "#263347" }} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="cmp-b" className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          Second evidence
        </Label>
        <select
          id="cmp-b"
          name="b"
          value={selectedB}
          onChange={(e) => setSelectedB(e.target.value)}
          className={fieldClass}
          required
        >
          <option value="">Select second file…</option>
          {filteredOptions.map((opt) => (
            <option key={`b-${opt.id}`} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {duplicateSelection ? (
        <p
          className="rounded-lg border px-3 py-2 text-xs"
          style={{
            borderColor: "rgba(239, 68, 68, 0.35)",
            backgroundColor: "rgba(127, 29, 29, 0.25)",
            color: "#fecaca",
          }}
        >
          Choose two different evidence files to compare.
        </p>
      ) : null}

      <Button
        type="submit"
        size="sm"
        disabled={!canCompare}
        className={cn(
          "w-full border border-[#2563eb] bg-[#1e40af] font-semibold text-white hover:bg-[#1d4ed8] sm:w-auto",
        )}
      >
        Open comparison
      </Button>
    </form>
  );
}
