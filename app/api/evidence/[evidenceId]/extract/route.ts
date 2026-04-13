import { extractTextForEvidence } from "@/services/text-extraction-service";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { resolveRequestActor } from "@/lib/resolve-request-actor";
import { logUsageEvent } from "@/services/usage-log-service";
import { logActivity } from "@/services/activity-service";

export const runtime = "nodejs";

/**
 * Re-run text extraction / OCR for an existing evidence file.
 * - Default: no-op if `extracted_texts` exist and status is not `error` (returns `{ skipped: true }` from service).
 * - `?force=1` or JSON `{ "force": true }`: replace `extracted_texts` after full extraction (idempotent replace).
 * - Status `error`: retries without requiring `force`.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ evidenceId: string }> },
) {
  const { evidenceId } = await params;
  const actor = await resolveRequestActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  let force =
    url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true";
  try {
    const body = (await request.json().catch(() => null)) as { force?: unknown } | null;
    if (body && typeof body.force === "boolean") {
      force = body.force;
    } else if (body && (body.force === "1" || body.force === 1)) {
      force = true;
    }
  } catch {
    /* ignore body parse */
  }

  const client = actor.mode === "user" ? actor.supabase : actor.service;

  const { data: ev, error: evErr } =
    actor.mode === "user"
      ? await client
          .from("evidence_files")
          .select("mime_type, case_id, guest_session_id")
          .eq("id", evidenceId)
          .maybeSingle()
      : await client
          .from("evidence_files")
          .select("mime_type, case_id, guest_session_id")
          .eq("id", evidenceId)
          .eq("guest_session_id", actor.guestSessionId)
          .maybeSingle();
  if (evErr || !ev) {
    return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
  }

  const result = await extractTextForEvidence(client, evidenceId, (ev.mime_type as string | null) ?? null, {
    force,
  });

  if (actor.mode === "user") {
    await logUsageEvent({ userId: actor.userId, action: "evidence.extract", meta: { evidenceId } });
  } else {
    await logUsageEvent({
      guestSessionId: actor.guestSessionId,
      action: "evidence.extract",
      meta: { evidenceId },
    });
  }

  const caseId = (ev.case_id as string | null) ?? null;
  if (caseId) {
    revalidatePath(`/cases/${caseId}`);
  }
  revalidatePath(`/evidence/${evidenceId}`);
  if (actor.mode === "user") {
    try {
      await logActivity(client, {
        caseId,
        actorId: actor.userId,
        actorLabel: "Analyst",
        action: "evidence.extract",
        entityType: "evidence_file",
        entityId: evidenceId,
        payload: { force },
      });
    } catch {
      /* non-blocking */
    }
  }

  return NextResponse.json(result);
}
