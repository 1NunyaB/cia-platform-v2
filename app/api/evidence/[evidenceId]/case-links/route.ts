import { createClient } from "@/lib/supabase/server";
import {
  getEvidenceById,
  linkEvidenceToCaseIfNeeded,
  listEvidenceLinkedCaseIds,
  unlinkEvidenceFromCase,
} from "@/services/evidence-service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ evidenceId: string }> }) {
  const { evidenceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await getEvidenceById(supabase, evidenceId);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const linkedCaseIds = await listEvidenceLinkedCaseIds(supabase, evidenceId);
    return NextResponse.json({ linkedCaseIds }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load links";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ evidenceId: string }> }) {
  const { evidenceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const row = await getEvidenceById(supabase, evidenceId);
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await request.json().catch(() => ({}))) as { caseId?: string; linked?: boolean };
  const caseId = body.caseId?.trim();
  const linked = body.linked === true;
  if (!caseId) {
    return NextResponse.json({ error: "caseId is required" }, { status: 400 });
  }

  try {
    if (linked) {
      await linkEvidenceToCaseIfNeeded(supabase, {
        evidenceId,
        targetCaseId: caseId,
        userId: user.id,
      });
    } else {
      await unlinkEvidenceFromCase(supabase, { evidenceId, caseId });
    }
    const linkedCaseIds = await listEvidenceLinkedCaseIds(supabase, evidenceId);
    return NextResponse.json({ ok: true, linkedCaseIds }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Update failed";
    const status = message.includes("Forbidden") ? 403 : message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
