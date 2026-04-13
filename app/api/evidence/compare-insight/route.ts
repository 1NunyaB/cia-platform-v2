import { resolveRequestActor } from "@/lib/resolve-request-actor";
import { getEvidenceById, getGuestEvidenceById } from "@/services/evidence-service";
import { runEvidenceCompareInsight } from "@/services/evidence-compare-insight-service";
import { NextResponse } from "next/server";
import { logActivity } from "@/services/activity-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const actor = await resolveRequestActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const auth = actor;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const leftId = typeof body.leftId === "string" ? body.leftId : "";
  const rightId = typeof body.rightId === "string" ? body.rightId : "";
  if (!leftId || !rightId || leftId === rightId) {
    return NextResponse.json({ error: "leftId and rightId must be two different evidence ids." }, { status: 400 });
  }

  const leftWidth = typeof body.leftWidth === "number" ? body.leftWidth : null;
  const leftHeight = typeof body.leftHeight === "number" ? body.leftHeight : null;
  const rightWidth = typeof body.rightWidth === "number" ? body.rightWidth : null;
  const rightHeight = typeof body.rightHeight === "number" ? body.rightHeight : null;

  async function loadRow(id: string) {
    if (auth.mode === "user") {
      return getEvidenceById(auth.supabase, id);
    }
    return getGuestEvidenceById(auth.service, id, auth.guestSessionId);
  }

  const [left, right] = await Promise.all([loadRow(leftId), loadRow(rightId)]);
  if (!left || !right) {
    return NextResponse.json({ error: "One or both evidence files were not found." }, { status: 404 });
  }

  const leftLabel =
    (left.display_filename as string | null)?.trim() || (left.original_filename as string) || leftId;
  const rightLabel =
    (right.display_filename as string | null)?.trim() || (right.original_filename as string) || rightId;

  try {
    const insight = await runEvidenceCompareInsight({
      leftLabel,
      rightLabel,
      leftMime: (left.mime_type as string | null) ?? null,
      rightMime: (right.mime_type as string | null) ?? null,
      leftWidth,
      leftHeight,
      rightWidth,
      rightHeight,
    });
    if (auth.mode === "user") {
      const leftCase = (left.case_id as string | null) ?? null;
      const rightCase = (right.case_id as string | null) ?? null;
      const caseId = leftCase && leftCase === rightCase ? leftCase : null;
      try {
        await logActivity(auth.supabase, {
          caseId,
          actorId: auth.userId,
          actorLabel: "Analyst",
          action: "evidence.compared",
          entityType: "evidence_pair",
          entityId: `${leftId}:${rightId}`,
          payload: { leftId, rightId },
        });
      } catch {
        /* non-blocking */
      }
    }
    return NextResponse.json({ insight });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Compare insight failed";
    const status = message.includes("OPENAI_API_KEY") ? 503 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
