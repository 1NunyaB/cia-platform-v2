import { createClient } from "@/lib/supabase/server";
import { tryCreateServiceClient } from "@/lib/supabase/service";
import { caseDirectoryPayloadSchema, normalizeCaseDirectoryPayload } from "@/lib/case-directory";
import { isBlankOrValidMonthYear } from "@/lib/case-month-year";
import { syncCaseIncidentTimelineEvents } from "@/services/case-incident-timeline-service";
import { createCase, findExistingCaseByNormalizedTitle } from "@/services/case-service";
import { NextResponse } from "next/server";
import { z } from "zod";

function withDefaultNestedArrays(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.incident_entries)) return raw;
  return {
    ...body,
    incident_entries: body.incident_entries.map((entry) => {
      if (!entry || typeof entry !== "object") return entry;
      const e = entry as Record<string, unknown>;
      return {
        ...e,
        people: Array.isArray(e.people) ? e.people : [],
        legal_milestones: Array.isArray(e.legal_milestones) ? e.legal_milestones : [],
        evidence_items: Array.isArray(e.evidence_items) ? e.evidence_items : [],
      };
    }),
  };
}

const bodySchema = z
  .object({
    title: z.string().min(1),
    description: z.string().optional().nullable(),
  })
  .merge(caseDirectoryPayloadSchema)
  .superRefine((data, ctx) => {
    for (let ei = 0; ei < data.incident_entries.length; ei++) {
      const entry = data.incident_entries[ei];
      for (let mi = 0; mi < entry.legal_milestones.length; mi++) {
        const my = entry.legal_milestones[mi]?.month_year?.trim() ?? "";
        if (my && !isBlankOrValidMonthYear(my)) {
          ctx.addIssue({
            code: "custom",
            message: "Each legal action needs a valid month/year.",
            path: ["incident_entries", ei, "legal_milestones", mi, "month_year"],
          });
        }
      }
    }
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

  const parsed = bodySchema.safeParse(withDefaultNestedArrays(json));
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
    const norm = normalizeCaseDirectoryPayload({
      incident_entries: d.incident_entries,
    });

    const { id } = await createCase(supabase, {
      userId: user.id,
      title: d.title,
      description: d.description,
      ...norm,
    });

    if (norm.incident_entries.length > 0) {
      await syncCaseIncidentTimelineEvents(supabase, id, norm.incident_entries);
    }

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
