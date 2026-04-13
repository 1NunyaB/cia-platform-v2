"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CreateCaseDialog } from "@/components/create-case-dialog";
import { FolderOpen, Plus } from "lucide-react";

export function DashboardHero({ canPersist }: { canPersist: boolean }) {
  return (
    <div className="mt-6 flex flex-wrap gap-3">
      <CreateCaseDialog disabled={!canPersist}>
        <Button size="lg" className="gap-2" disabled={!canPersist}>
          <Plus className="h-4 w-4" />
          New investigation
        </Button>
      </CreateCaseDialog>
      <Button asChild variant="outline" size="lg" className="gap-2">
        <Link href="/cases">
          <FolderOpen className="h-4 w-4" />
          All investigations
        </Link>
      </Button>
    </div>
  );
}
