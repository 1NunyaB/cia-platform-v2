import { createClient } from "@/lib/supabase/server";
import { resolveFreeformCatalogLabel } from "@/lib/freeform-catalog-label";
import {
  resolveAndEnsureLegalActionLabel,
  searchLegalActionLabels,
} from "@/services/legal-action-label-catalog";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") ?? "";

  try {
    const actions = await searchLegalActionLabels(supabase, q, 40);
    return NextResponse.json({ actions });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { label?: string };
  try {
    body = (await request.json()) as { label?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const raw = typeof body.label === "string" ? body.label.trim() : "";
  if (!raw) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const preview = resolveFreeformCatalogLabel(raw);
  if (!preview.normalized) {
    return NextResponse.json({ error: "Invalid label" }, { status: 400 });
  }

  try {
    const label = await resolveAndEnsureLegalActionLabel(supabase, raw);
    return NextResponse.json({ label: label ?? preview.label });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
