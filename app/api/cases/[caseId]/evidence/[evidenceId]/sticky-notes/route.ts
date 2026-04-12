import { createClient } from "@/lib/supabase/server";
import { getEvidenceById } from "@/services/evidence-service";
import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const bodySchema = z.object({
  body: z.string().min(1).max(8000),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ caseId: string; evidenceId: string }> },
) {
  const { caseId, evidenceId } = await params;
  const supabase = await createClient();
  const ev = await getEvidenceById(supabase, evidenceId);
  if (!ev || ev.case_id !== caseId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { data: stickies, error } = await supabase
    .from("evidence_sticky_notes")
    .select("*")
    .eq("evidence_file_id", evidenceId)
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const withReplies = await Promise.all(
    (stickies ?? []).map(async (s) => {
      const { data: replies } = await supabase
        .from("evidence_sticky_note_replies")
        .select("*")
        .eq("sticky_note_id", s.id as string)
        .order("created_at", { ascending: true });
      return { sticky: s, replies: replies ?? [] };
    }),
  );
  return NextResponse.json({ stickies: withReplies });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string; evidenceId: string }> },
) {
  const { caseId, evidenceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ev = await getEvidenceById(supabase, evidenceId);
  if (!ev || ev.case_id !== caseId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("evidence_sticky_notes")
    .insert({
      case_id: caseId,
      evidence_file_id: evidenceId,
      author_id: user.id,
      body: parsed.data.body,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath(`/cases/${caseId}/evidence/${evidenceId}`);
  return NextResponse.json({ id: data!.id });
}
