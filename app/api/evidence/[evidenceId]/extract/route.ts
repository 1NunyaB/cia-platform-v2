import { createClient } from "@/lib/supabase/server";
import { extractTextForEvidence } from "@/services/text-extraction-service";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
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

  const { data: ev, error: evErr } = await supabase
    .from("evidence_files")
    .select("mime_type, case_id")
    .eq("id", evidenceId)
    .maybeSingle();
  if (evErr || !ev) {
    return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
  }

  const result = await extractTextForEvidence(supabase, evidenceId, (ev.mime_type as string | null) ?? null, {
    force,
  });

  const caseId = (ev.case_id as string | null) ?? null;
  if (caseId) {
    revalidatePath(`/cases/${caseId}`);
  }
  revalidatePath(`/evidence/${evidenceId}`);

  return NextResponse.json(result);
}
