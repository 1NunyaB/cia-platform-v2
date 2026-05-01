import { createClient } from "@/lib/supabase/server";
import { resolveFreeformCatalogLabel } from "@/lib/freeform-catalog-label";
import { resolveAndEnsureCityOption, searchCityOptions } from "@/services/city-options-catalog";
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
  const state = (searchParams.get("state") ?? "").trim().toUpperCase();
  const q = searchParams.get("q") ?? "";

  if (!state) {
    return NextResponse.json({ error: "state is required" }, { status: 400 });
  }

  try {
    const cities = await searchCityOptions(supabase, state, q, 50);
    return NextResponse.json({ cities });
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

  let body: { state?: string; label?: string };
  try {
    body = (await request.json()) as { state?: string; label?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const state = typeof body.state === "string" ? body.state.trim().toUpperCase() : "";
  const raw = typeof body.label === "string" ? body.label.trim() : "";
  if (!state) {
    return NextResponse.json({ error: "state is required" }, { status: 400 });
  }
  if (!raw) {
    return NextResponse.json({ error: "label is required" }, { status: 400 });
  }

  const preview = resolveFreeformCatalogLabel(raw);
  if (!preview.normalized) {
    return NextResponse.json({ error: "Invalid city name" }, { status: 400 });
  }

  try {
    const label = await resolveAndEnsureCityOption(supabase, state, raw);
    return NextResponse.json({ label: label ?? preview.label });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
