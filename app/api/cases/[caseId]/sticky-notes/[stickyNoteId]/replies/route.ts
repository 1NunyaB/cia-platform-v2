import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const bodySchema = z.object({
  body: z.string().min(1).max(4000),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string; stickyNoteId: string }> },
) {
  const { caseId, stickyNoteId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: sn, error: fErr } = await supabase
    .from("evidence_sticky_notes")
    .select("id, evidence_file_id")
    .eq("id", stickyNoteId)
    .eq("case_id", caseId)
    .maybeSingle();

  if (fErr || !sn) {
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
    .from("evidence_sticky_note_replies")
    .insert({
      sticky_note_id: stickyNoteId,
      author_id: user.id,
      body: parsed.data.body,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath(`/cases/${caseId}/evidence/${sn.evidence_file_id as string}`);
  return NextResponse.json({ id: data!.id });
}
