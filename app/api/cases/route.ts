import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceClient } from "@/lib/supabase/service";
import { createCase, findRecentDuplicateCaseInWindow } from "@/services/case-service";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  visibility: z.enum(["private", "team", "public"]),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idempotencyKey = request.headers.get("Idempotency-Key")?.trim();

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

  const privileged = tryCreateServiceClient() ?? supabase;

  if (idempotencyKey) {
    const { data: existing, error: idemSelectErr } = await privileged
      .from("case_creation_idempotency")
      .select("case_id")
      .eq("user_id", user.id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (idemSelectErr && !idemSelectErr.message.includes("does not exist")) {
      console.warn("[case dedupe] idempotency select:", idemSelectErr.message);
    }
    if (existing?.case_id) {
      return NextResponse.json({ id: existing.case_id as string, idempotentReplay: true });
    }
  }

  try {
    const duplicateId = await findRecentDuplicateCaseInWindow(privileged, {
      title: parsed.data.title,
      visibility: parsed.data.visibility,
    });
    if (duplicateId) {
      return NextResponse.json({ id: duplicateId, duplicateSuppressed: true });
    }

    const { id } = await createCase(supabase, {
      userId: user.id,
      title: parsed.data.title,
      description: parsed.data.description,
      visibility: parsed.data.visibility,
    });

    if (idempotencyKey) {
      const { error: idemErr } = await privileged.from("case_creation_idempotency").insert({
        user_id: user.id,
        idempotency_key: idempotencyKey,
        case_id: id,
      });
      if (idemErr?.code === "23505") {
        const { data: row } = await privileged
          .from("case_creation_idempotency")
          .select("case_id")
          .eq("user_id", user.id)
          .eq("idempotency_key", idempotencyKey)
          .maybeSingle();
        if (row?.case_id) {
          return NextResponse.json({ id: row.case_id as string, idempotentReplay: true });
        }
      } else if (idemErr && !idemErr.message.includes("does not exist")) {
        console.warn("[case dedupe] case_creation_idempotency insert:", idemErr.message);
      }
    }

    return NextResponse.json({ id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to create case";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
