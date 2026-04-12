"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const TABLES = ["evidence_files", "entities", "entity_aliases", "timeline_events", "evidence_clusters"] as const;

/**
 * Refreshes the case workspace when index-relevant rows change (uploads, analysis graph, timelines, clusters).
 */
export function CaseWorkspaceRealtime({ caseId }: { caseId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(`case-workspace:${caseId}`);

    for (const table of TABLES) {
      channel.on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `case_id=eq.${caseId}`,
        },
        () => {
          router.refresh();
        },
      );
    }

    void channel.subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [caseId, router]);

  return null;
}
