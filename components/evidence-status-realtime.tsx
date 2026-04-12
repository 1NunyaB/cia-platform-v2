"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Refreshes the case page when `evidence_files` rows for this case change (e.g. processing status).
 * Requires `evidence_files` in Supabase Realtime publication.
 */
export function EvidenceStatusRealtime({ caseId }: { caseId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`evidence:${caseId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "evidence_files",
          filter: `case_id=eq.${caseId}`,
        },
        () => {
          router.refresh();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [caseId, router]);

  return null;
}
