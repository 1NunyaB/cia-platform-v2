"use client";

import Link from "next/link";
import { Activity, Archive, BriefcaseBusiness, Flag, Network, FileStack } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function DashboardCaseActivityPanel({
  activeCases,
  evidenceItems,
  entities,
  highPriorityCases,
}: {
  activeCases: number;
  evidenceItems: number;
  entities: number;
  highPriorityCases: number;
}) {
  return (
    <Card className="border-slate-500/75 bg-gradient-to-br from-slate-800 to-slate-900 text-slate-100 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Activity className="h-4 w-4 text-emerald-300" />
          Case Activity Pulse
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-slate-300">Active investigations right now: {activeCases}</p>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="rounded border border-slate-600/80 bg-slate-800/60 p-2">
            <p className="text-slate-300">Active Cases</p>
            <p className="font-semibold text-slate-100">{activeCases}</p>
          </div>
          <div className="rounded border border-slate-600/80 bg-slate-800/60 p-2">
            <p className="text-slate-300">Evidence Items</p>
            <p className="font-semibold text-slate-100">{evidenceItems}</p>
          </div>
          <div className="rounded border border-slate-600/80 bg-slate-800/60 p-2">
            <p className="text-slate-300">Entities</p>
            <p className="font-semibold text-slate-100">{entities}</p>
          </div>
          <div className="rounded border border-slate-600/80 bg-slate-800/60 p-2">
            <p className="text-slate-300">High Priority Cases</p>
            <p className="font-semibold text-slate-100">{highPriorityCases}</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-300">Quick Launch</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" className="h-7 border-slate-500 bg-slate-700 text-slate-100" asChild>
              <Link href="/cases/new">
                <BriefcaseBusiness className="mr-1 h-3.5 w-3.5" />
                New Case
              </Link>
            </Button>
            <Button size="sm" variant="outline" className="h-7 border-slate-500 bg-slate-700 text-slate-100" asChild>
              <Link href="/cases">
                <Archive className="mr-1 h-3.5 w-3.5" />
                Cases Archive
              </Link>
            </Button>
            <Button size="sm" variant="outline" className="h-7 border-slate-500 bg-slate-700 text-slate-100" asChild>
              <Link href="/evidence">
                <FileStack className="mr-1 h-3.5 w-3.5" />
                Evidence
              </Link>
            </Button>
            <Button size="sm" variant="outline" className="h-7 border-slate-500 bg-slate-700 text-slate-100" asChild>
              <Link href="/cases?priority=high">
                <Flag className="mr-1 h-3.5 w-3.5" />
                Priority
              </Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

