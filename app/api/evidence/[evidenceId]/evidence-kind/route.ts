import { parseEvidenceKind } from "@/lib/evidence-kind";
import { resolveRequestActor } from "@/lib/resolve-request-actor";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Confirm or reclassify evidence kind (Document / Image / Video / Audio).
 * Separate from evidence stacks — only affects library filtering and display labels.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ evidenceId: string }> },
) {
  const { evidenceId } = await params;
  const actor = await resolveRequestActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw =
    typeof body === "object" && body !== null && "confirmedKind" in body
      ? (body as { confirmedKind?: unknown }).confirmedKind
      : undefined;
  const kind = parseEvidenceKind(raw);
  if (!kind) {
    return NextResponse.json(
      { error: "confirmedKind must be document, image, video, or audio" },
      { status: 400 },
    );
  }

  const confirmedAt = new Date().toISOString();

  if (actor.mode === "user") {
    const supabase = actor.supabase;
    const { data: row, error: fetchErr } = await supabase
      .from("evidence_files")
      .select("id")
      .eq("id", evidenceId)
      .maybeSingle();
    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 400 });
    }
    if (!row) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
    }

    const { error: updErr } = await supabase
      .from("evidence_files")
      .update({
        confirmed_evidence_kind: kind,
        evidence_kind_confirmed_at: confirmedAt,
      })
      .eq("id", evidenceId);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: updErr.code === "42501" ? 403 : 400 });
    }
  } else {
    const supabase = actor.service;
    const { data: row, error: fetchErr } = await supabase
      .from("evidence_files")
      .select("id")
      .eq("id", evidenceId)
      .eq("guest_session_id", actor.guestSessionId)
      .maybeSingle();
    if (fetchErr) {
      return NextResponse.json({ error: fetchErr.message }, { status: 400 });
    }
    if (!row) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
    }

    const { error: updErr } = await supabase
      .from("evidence_files")
      .update({
        confirmed_evidence_kind: kind,
        evidence_kind_confirmed_at: confirmedAt,
      })
      .eq("id", evidenceId)
      .eq("guest_session_id", actor.guestSessionId);
    if (updErr) {
      return NextResponse.json({ error: updErr.message }, { status: 400 });
    }
  }

  return NextResponse.json({
    confirmedKind: kind,
    evidenceKindConfirmedAt: confirmedAt,
  });
}
