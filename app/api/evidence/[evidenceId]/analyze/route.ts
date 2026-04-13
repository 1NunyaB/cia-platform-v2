import { getExtractedText } from "@/services/evidence-service";
import { runAiAnalysisForEvidence } from "@/services/ai-analysis-service";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { resolveRequestActor } from "@/lib/resolve-request-actor";
import { logUsageEvent } from "@/services/usage-log-service";
import { logActivity } from "@/services/activity-service";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ evidenceId: string }> },
) {
  const { evidenceId } = await params;
  const url = new URL(request.url);
  const force =
    url.searchParams.get("force") === "1" || url.searchParams.get("force") === "true";

  const actor = await resolveRequestActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = actor.mode === "user" ? actor.supabase : actor.service;

  const { data: ev, error: evErr } =
    actor.mode === "user"
      ? await client
          .from("evidence_files")
          .select("id, case_id, processing_status")
          .eq("id", evidenceId)
          .maybeSingle()
      : await client
          .from("evidence_files")
          .select("id, case_id, processing_status")
          .eq("id", evidenceId)
          .eq("guest_session_id", actor.guestSessionId)
          .maybeSingle();
  if (evErr || !ev) {
    return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
  }

  const ps = ev.processing_status as string;
  if (ps === "blocked") {
    return NextResponse.json({ error: "This evidence item was blocked and cannot be analyzed." }, { status: 400 });
  }
  if (ps !== "complete") {
    return NextResponse.json(
      {
        error: "Evidence is not ready for analysis yet. Wait for extraction to finish (status must be complete).",
      },
      { status: 400 },
    );
  }

  const extracted = await getExtractedText(client, evidenceId);
  const text = extracted?.raw_text ?? "";

  if (!text.trim()) {
    return NextResponse.json(
      {
        error:
          "No extracted text available. Upload a text-based PDF, plain text, or a scannable image/PDF so OCR can run.",
      },
      { status: 400 },
    );
  }

  if (!force) {
    const { data: existing } = await client
      .from("ai_analyses")
      .select("id, structured")
      .eq("evidence_file_id", evidenceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existing?.structured && typeof existing.structured === "object") {
      const caseId = (ev.case_id as string | null) ?? null;
      if (caseId) {
        revalidatePath(`/cases/${caseId}`);
      }
      revalidatePath(`/evidence/${evidenceId}`);
      return NextResponse.json({ analysisId: existing.id as string, cached: true });
    }
  }

  try {
    const caseId = (ev.case_id as string | null) ?? null;
    const result = await runAiAnalysisForEvidence(client, {
      evidenceId,
      caseId,
      userId: actor.mode === "user" ? actor.userId : null,
      guestSessionId: actor.mode === "guest" ? actor.guestSessionId : null,
      extractedText: text,
    });
    if (actor.mode === "user") {
      await logUsageEvent({ userId: actor.userId, action: "evidence.analyze", meta: { evidenceId } });
    } else {
      await logUsageEvent({
        guestSessionId: actor.guestSessionId,
        action: "evidence.analyze",
        meta: { evidenceId },
      });
    }
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
          action: "evidence.analyze",
          entityType: "evidence_file",
          entityId: evidenceId,
          payload: { force },
        });
      } catch {
        /* non-blocking */
      }
    }
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
