"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { dispatchWorkspaceAiAttachEvidence } from "@/lib/workspace-evidence-ai-bridge";

export type DashboardCaseFeedRow = {
  id: string;
  title: string;
  incident_city?: string | null;
  incident_state?: string | null;
  status: "not_started" | "active" | "on_hold";
  investigatorCount: number;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  joined: boolean;
};

const priorityClass: Record<DashboardCaseFeedRow["priority"], string> = {
  LOW: "border-slate-500 bg-slate-800 text-slate-100",
  MEDIUM: "border-sky-500 bg-sky-900/40 text-sky-100",
  HIGH: "border-amber-500 bg-amber-900/35 text-amber-100",
  CRITICAL: "border-red-500 bg-red-900/35 text-red-100",
};

function statusLabel(status: DashboardCaseFeedRow["status"]): string {
  if (status === "active") return "Active";
  if (status === "on_hold") return "On hold";
  return "Not started";
}

export function DashboardCasesFeed({
  rows,
  selectedCaseId,
  onSelectCase,
}: {
  rows: DashboardCaseFeedRow[];
  selectedCaseId: string | null;
  onSelectCase: (caseId: string) => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);

  async function callCaseAction(caseId: string, action: "start" | "join" | "hold") {
    setBusy(`${caseId}:${action}`);
    try {
      const res = await fetch(`/api/cases/${caseId}/${action}`, { method: "POST", credentials: "include" });
      if (res.ok) {
        onSelectCase(caseId);
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="min-h-[44vh] border-slate-500/70 bg-gradient-to-br from-slate-800 to-slate-900 text-slate-100 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-slate-100">Cases Feed</CardTitle>
        <CardDescription className="text-xs text-slate-300">
          Active investigations board. Select a case to load context into AI and case notes.
        </CardDescription>
      </CardHeader>
      <CardContent className="h-[calc(44vh-68px)] min-h-[260px]">
        {rows.length === 0 ? (
          <div className="rounded-md border border-slate-600/80 bg-slate-900/60 px-3 py-4 text-sm text-slate-300">
            No cases available.
          </div>
        ) : (
          <ul className="h-full divide-y divide-slate-600/80 overflow-y-auto rounded-md border border-slate-600/80 bg-slate-900/60">
            {rows.map((row) => {
              const isSelected = selectedCaseId === row.id;
              const loc = [row.incident_city, row.incident_state].filter(Boolean).join(", ");
              return (
                <li
                  key={row.id}
                  className={`px-3 py-2.5 ${isSelected ? "bg-sky-900/30 ring-1 ring-sky-400/60" : "hover:bg-slate-700/35"}`}
                >
                  <button type="button" className="w-full text-left" onClick={() => onSelectCase(row.id)}>
                    <p className="truncate text-sm font-semibold text-slate-100">{row.title}</p>
                    <p className="text-[11px] text-slate-300">{loc || "Location not set"}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[10px]">
                      <span className="rounded border border-slate-500 px-1.5 py-0.5 text-slate-200">
                        {statusLabel(row.status)}
                      </span>
                      <span className="rounded border border-slate-500 px-1.5 py-0.5 text-slate-200">
                        Investigators: {row.investigatorCount}
                      </span>
                      <span className={`rounded border px-1.5 py-0.5 font-semibold ${priorityClass[row.priority]}`}>
                        {row.priority}
                      </span>
                    </div>
                  </button>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 bg-sky-700 text-white hover:bg-sky-600"
                      onClick={() => void callCaseAction(row.id, "start")}
                      disabled={busy === `${row.id}:start` || row.status === "active"}
                    >
                      {busy === `${row.id}:start` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Start Investigation"}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 border-slate-500 bg-slate-700 text-slate-100"
                      onClick={() => void callCaseAction(row.id, "join")}
                      disabled={busy === `${row.id}:join` || row.joined}
                    >
                      {row.joined ? "Joined" : "Join Case"}
                    </Button>
                    <Button type="button" size="sm" variant="outline" className="h-7 border-slate-500 bg-slate-700 text-slate-100" asChild>
                      <Link href={`/cases/${row.id}`}>View Case</Link>
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 border-amber-500 bg-amber-900/35 text-amber-100"
                      onClick={() => void callCaseAction(row.id, "hold")}
                      disabled={busy === `${row.id}:hold` || row.status !== "active"}
                    >
                      Put on Hold
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-sky-200 hover:bg-sky-900/30"
                      onClick={() => {
                        onSelectCase(row.id);
                        dispatchWorkspaceAiAttachEvidence({ caseId: row.id });
                      }}
                    >
                      Load in AI
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

