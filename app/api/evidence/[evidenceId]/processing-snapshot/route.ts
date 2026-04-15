import { resolveRequestActor } from "@/lib/resolve-request-actor";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/** Lightweight status for intake / batch UIs (same access pattern as file-url). */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ evidenceId: string }> },
) {
  const { evidenceId } = await params;
  const actor = await resolveRequestActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = actor.mode === "user" ? actor.supabase : actor.service;
  let q = client
    .from("evidence_files")
    .select("extraction_status, processing_status")
    .eq("id", evidenceId);
  if (actor.mode === "guest") {
    q = q.eq("guest_session_id", actor.guestSessionId);
  }
  const { data: row, error } = await q.maybeSingle();
  if (error || !row) {
    return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
  }

  return NextResponse.json({
    extraction_status: (row.extraction_status as string | null) ?? null,
    processing_status: (row.processing_status as string | null) ?? null,
  });
}
