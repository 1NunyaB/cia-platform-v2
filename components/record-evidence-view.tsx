"use client";

import { useEffect, useRef } from "react";

/** Fire-and-forget: marks library evidence as viewed for the signed-in user (no-op for guests / on failure). */
export function RecordEvidenceView({ evidenceId }: { evidenceId: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    void fetch(`/api/evidence/${evidenceId}/view`, { method: "POST" }).catch(() => {
      /* non-fatal */
    });
  }, [evidenceId]);
  return null;
}
