import { createClient } from "@/lib/supabase/server";
import { getExtractedText } from "@/services/evidence-service";
import { runAiAnalysisForEvidence } from "@/services/ai-analysis-service";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ evidenceId: string }> },
) {
  const { evidenceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: ev, error: evErr } = await supabase
    .from("evidence_files")
    .select("id, case_id, processing_status")
    .eq("id", evidenceId)
    .single();
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

  const extracted = await getExtractedText(supabase, evidenceId);
  const text = extracted?.raw_text ?? "";

  if (!text.trim()) {
    return NextResponse.json(
      {
        error:
          "No extracted text available. Upload a text-based PDF or plain text, or connect OCR (TODO in text-extraction-service).",
      },
      { status: 400 },
    );
  }

  try {
    const caseId = (ev.case_id as string | null) ?? null;
    const result = await runAiAnalysisForEvidence(supabase, {
      evidenceId,
      caseId,
      userId: user.id,
      extractedText: text,
    });
    if (caseId) {
      revalidatePath(`/cases/${caseId}`);
    }
    revalidatePath(`/evidence/${evidenceId}`);
    return NextResponse.json(result);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
