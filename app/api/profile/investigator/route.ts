import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const MAX_ALIAS = 80;
const MAX_TAGLINE = 160;

/** Read or update opt-in investigator identity (registered users only). Avatar images use POST /api/profile/investigator/avatar — not manual URLs. */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "investigator_opt_in, investigator_alias, investigator_avatar_url, investigator_tagline",
    )
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({
    investigator_opt_in: Boolean(data?.investigator_opt_in),
    investigator_alias: (data?.investigator_alias as string | null) ?? null,
    investigator_avatar_url: (data?.investigator_avatar_url as string | null) ?? null,
    investigator_tagline: (data?.investigator_tagline as string | null) ?? null,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const o = body as Record<string, unknown>;

  const optIn = o.investigator_opt_in === true;
  const aliasRaw = typeof o.investigator_alias === "string" ? o.investigator_alias.trim() : "";
  const taglineRaw =
    typeof o.investigator_tagline === "string" ? o.investigator_tagline.trim() : "";

  if (optIn && !aliasRaw) {
    return NextResponse.json(
      { error: "An alias is required when opting in to the investigator wall." },
      { status: 400 },
    );
  }

  const patch: Record<string, unknown> = {
    investigator_opt_in: optIn,
    investigator_alias: optIn ? aliasRaw.slice(0, MAX_ALIAS) : null,
    investigator_tagline: optIn && taglineRaw ? taglineRaw.slice(0, MAX_TAGLINE) : null,
  };

  if (!optIn) {
    patch.investigator_alias = null;
    patch.investigator_tagline = null;
    patch.investigator_avatar_url = null;
  }

  const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
