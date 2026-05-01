import { createClient } from "@/lib/supabase/server";
import { resolveSourceSiteHostForStorage } from "@/lib/source-site-host";
import { resolveAndEnsureSourceSiteHost, searchSourceSiteHosts } from "@/services/source-site-host-catalog";
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
    const hosts = await searchSourceSiteHosts(supabase, q, 40);
    return NextResponse.json({ hosts });
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

  const preview = resolveSourceSiteHostForStorage(raw);
  if (!preview.normalized) {
    return NextResponse.json({ error: "Invalid site" }, { status: 400 });
  }

  try {
    const label = await resolveAndEnsureSourceSiteHost(supabase, raw);
    return NextResponse.json({ label: label ?? preview.label });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
