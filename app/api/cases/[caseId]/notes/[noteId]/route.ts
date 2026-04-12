import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const patchSchema = z.object({
  body: z.string().min(1).optional(),
  visibility: z.enum(["private", "shared_case", "public_case"]).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ caseId: string; noteId: string }> },
) {
  const { caseId, noteId } = await params;
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

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (!parsed.data.body && parsed.data.visibility === undefined) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data: note, error: nErr } = await supabase
    .from("notes")
    .select("id, case_id")
    .eq("id", noteId)
    .eq("case_id", caseId)
    .maybeSingle();

  if (nErr || !note) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (parsed.data.body !== undefined) updates.body = parsed.data.body;
  if (parsed.data.visibility !== undefined) {
    if (parsed.data.visibility === "public_case") {
      const { data: c } = await supabase.from("cases").select("visibility").eq("id", caseId).single();
      if (c?.visibility !== "public") {
        return NextResponse.json(
          { error: "Public notes are only allowed when the case is public." },
          { status: 400 },
        );
      }
    }
    updates.visibility = parsed.data.visibility;
  }

  const { error } = await supabase.from("notes").update(updates).eq("id", noteId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  revalidatePath(`/cases/${caseId}`);
  return NextResponse.json({ ok: true });
}
