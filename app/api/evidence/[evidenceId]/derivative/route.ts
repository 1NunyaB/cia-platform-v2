import { createClient } from "@/lib/supabase/server";
import { EvidenceDuplicateError } from "@/lib/evidence-upload-errors";
import { buildDuplicateEvidenceResponse } from "@/services/duplicate-evidence-response";
import { ingestDerivativeUploadedFile } from "@/services/case-evidence-ingest";
import { requestClientIp, requestUserAgent } from "@/lib/request-audit";
import { logUsageEvent } from "@/services/usage-log-service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ evidenceId: string }> },
) {
  const { evidenceId: sourceEvidenceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || !file.size) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const uploaderIp = requestClientIp(request);
  const userAgent = requestUserAgent(request);

  try {
    const r = await ingestDerivativeUploadedFile(supabase, {
      sourceEvidenceId,
      userId: user.id,
      file,
      audit: { uploaderIp, userAgent },
    });
    await logUsageEvent({
      userId: user.id,
      action: "evidence.upload",
      meta: { scope: "derivative", sourceEvidenceId },
    });
    const { data: row } = await supabase
      .from("evidence_files")
      .select("case_id")
      .eq("id", r.id)
      .maybeSingle();
    const caseId = (row?.case_id as string | null) ?? null;
    if (r.warning) {
      return NextResponse.json({ id: r.id, caseId, warning: r.warning }, { status: 201 });
    }
    return NextResponse.json({ id: r.id, caseId }, { status: 201 });
  } catch (e) {
    if (e instanceof EvidenceDuplicateError) {
      const body = await buildDuplicateEvidenceResponse(supabase, e);
      return NextResponse.json(body, { status: 200 });
    }
    const message = e instanceof Error ? e.message : "Derivative upload failed";
    const status = message.includes("Forbidden") ? 403 : message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
