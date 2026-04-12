import { createClient } from "@/lib/supabase/server";
import { addCaseNote } from "@/services/notes-service";
import { getCaseById } from "@/services/case-service";
import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

const bodySchema = z.object({
  body: z.string().min(1),
  evidenceFileId: z.string().uuid().optional().nullable(),
  authorLabel: z.string().min(1).max(80).optional().nullable(),
  visibility: z.enum(["private", "shared_case", "public_case"]).optional(),
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

  const visibility = parsed.data.visibility ?? "shared_case";
  const c = await getCaseById(supabase, caseId);
  if (!c) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }
  if (visibility === "public_case" && c.visibility !== "public") {
    return NextResponse.json(
      { error: "Public notes require the case to be public." },
      { status: 400 },
    );
  }

  try {
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await addCaseNote(supabase, {
      caseId,
      authorId: user.id,
      authorLabel: null,
      body: parsed.data.body,
      evidenceFileId: parsed.data.evidenceFileId ?? null,
      visibility,
    });

    revalidatePath(`/cases/${caseId}`);
    return NextResponse.json({ id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to add note";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}