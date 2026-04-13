import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceClient } from "@/lib/supabase/service";
import { createCase, findExistingCaseByNormalizedTitle } from "@/services/case-service";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().nullable(),
  incident_year: z.number().int().min(1000).max(9999).optional().nullable(),
  incident_city: z.string().max(200).optional().nullable(),
  incident_state: z.string().max(100).optional().nullable(),
  accused_label: z.string().max(500).optional().nullable(),
  victim_labels: z.string().max(2000).optional().nullable(),
  known_weapon: z.string().max(500).optional().nullable(),
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
    const existingId = await findExistingCaseByNormalizedTitle(privileged, {
      title: parsed.data.title,
    });
    if (existingId) {
      return NextResponse.json({ id: existingId, duplicateSuppressed: true });
    }

    const d = parsed.data;
    const { id } = await createCase(supabase, {
      userId: user.id,
      title: d.title,
      description: d.description,
      incident_year: d.incident_year ?? null,
      incident_city: d.incident_city?.trim() || null,
      incident_state: d.incident_state?.trim() || null,
      accused_label: d.accused_label?.trim() || null,
      victim_labels: d.victim_labels?.trim() || null,
      known_weapon: d.known_weapon?.trim() || null,
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
