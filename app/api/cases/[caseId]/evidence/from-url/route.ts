import { createClient } from "@/lib/supabase/server";
import { EvidenceDuplicateError } from "@/lib/evidence-upload-errors";
import { ingestEvidenceFromUrl } from "@/services/case-evidence-ingest";
import { normalizeEvidenceSourcePayload, type EvidenceSourceType } from "@/lib/evidence-source";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url : "";
  const forceDuplicate = body.force_duplicate === true || body.force_duplicate === "true";

  const source = normalizeEvidenceSourcePayload({
    source_type:
      typeof body.source_type === "string" ? (body.source_type as EvidenceSourceType) : "article",
    source_platform: typeof body.source_platform === "string" ? body.source_platform : undefined,
    source_program: typeof body.source_program === "string" ? body.source_program : undefined,
    source_url: typeof body.source_url === "string" && body.source_url.trim() ? body.source_url : url,
  });

  try {
    const r = await ingestEvidenceFromUrl(supabase, {
      caseId,
      userId: user.id,
      url,
      source,
      forceDuplicate,
    });
    if (r.warning) {
      return NextResponse.json({ id: r.id, warning: r.warning }, { status: 201 });
    }
    return NextResponse.json({ id: r.id }, { status: 201 });
  } catch (e) {
    if (e instanceof EvidenceDuplicateError) {
      return NextResponse.json(
        { error: e.message, duplicate: true, existing: e.existing },
        { status: 409 },
      );
    }
    const message = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
