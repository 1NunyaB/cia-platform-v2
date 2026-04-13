import { createClient } from "@/lib/supabase/server";
import { linkEvidenceToAdditionalCase } from "@/services/evidence-service";
import { scoreEvidenceAgainstCase } from "@/services/evidence-share-relevance";
import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({
  caseId: z.string().uuid(),
  confirmWeakLink: z.boolean().optional(),
});

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

  const { caseId, confirmWeakLink } = parsed.data;

  try {
    const scored = await scoreEvidenceAgainstCase(supabase, evidenceId, caseId);
    if (!scored) {
      return NextResponse.json({ error: "Could not score relevance for this target." }, { status: 400 });
    }
    if (!scored.strong && !confirmWeakLink) {
      return NextResponse.json(
        {
          error: "weak_relevance",
          score: scored.score,
          message:
            "No strong relevance was found between this file and the selected investigation. Continue linking anyway?",
        },
        { status: 409 },
      );
    }

    await linkEvidenceToAdditionalCase(supabase, {
      evidenceId,
      targetCaseId: caseId,
      userId: user.id,
    });
    return NextResponse.json({ ok: true, caseId }, { status: 200 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Link failed";
    const status = message.includes("not found")
      ? 404
      : message.includes("Forbidden")
        ? 403
        : message.includes("already linked")
          ? 409
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
