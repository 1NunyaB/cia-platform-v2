import { createClient } from "@/lib/supabase/server";
import { addComment } from "@/services/notes-service";
import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const bodySchema = z.object({
  body: z.string().min(1),
  evidenceFileId: z.string().uuid().optional().nullable(),
  noteId: z.string().uuid().optional().nullable(),
  parentCommentId: z.string().uuid().optional().nullable(),
});

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

  try {
    if (parsed.data.parentCommentId) {
      const { data: parent } = await supabase
        .from("comments")
        .select("id, evidence_file_id, case_id")
        .eq("id", parsed.data.parentCommentId)
        .maybeSingle();
      if (!parent || parent.case_id !== caseId) {
        return NextResponse.json({ error: "Invalid parent comment" }, { status: 400 });
      }
      const ev = parsed.data.evidenceFileId;
      if (ev && parent.evidence_file_id && parent.evidence_file_id !== ev) {
        return NextResponse.json({ error: "Parent comment belongs to different evidence" }, { status: 400 });
      }
    }

    const { id } = await addComment(supabase, {
      caseId,
      authorId: user.id,
      body: parsed.data.body,
      evidenceFileId: parsed.data.evidenceFileId ?? null,
      noteId: parsed.data.noteId ?? null,
      parentCommentId: parsed.data.parentCommentId ?? null,
    });
    revalidatePath(`/cases/${caseId}`);
    if (parsed.data.evidenceFileId) {
      revalidatePath(`/cases/${caseId}/evidence/${parsed.data.evidenceFileId}`);
    }
    return NextResponse.json({ id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add comment";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
