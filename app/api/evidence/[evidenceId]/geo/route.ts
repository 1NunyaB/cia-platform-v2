import { resolveRequestActor } from "@/lib/resolve-request-actor";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function parseBody(raw: unknown): { latitude: number; longitude: number } | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const lat = o.latitude;
  const lon = o.longitude;
  if (typeof lat !== "number" || typeof lon !== "number") return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { latitude: lat, longitude: lon };
}

/**
 * Set WGS84 coordinates for evidence (e.g. Location-category files for the map).
 * Requires signed-in user; guest sessions cannot set geo.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ evidenceId: string }> }) {
  const { evidenceId } = await params;
  const actor = await resolveRequestActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (actor.mode !== "user") {
    return NextResponse.json({ error: "Sign in to set coordinates" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const coords = parseBody(body);
  if (!coords) {
    return NextResponse.json(
      { error: "latitude and longitude must be finite numbers (lat −90…90, lon −180…180)" },
      { status: 400 },
    );
  }

  const supabase = actor.supabase;
  const { data: row, error: fetchErr } = await supabase
    .from("evidence_files")
    .select("id, image_category")
    .eq("id", evidenceId)
    .maybeSingle();
  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 400 });
  }
  if (!row) {
    return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
  }
  if ((row.image_category as string | null) !== "location") {
    return NextResponse.json(
      { error: "Set image folder to Location (Analyze → Image analysis) before adding map coordinates." },
      { status: 400 },
    );
  }

  const { error: updErr } = await supabase
    .from("evidence_files")
    .update({
      latitude: coords.latitude,
      longitude: coords.longitude,
    })
    .eq("id", evidenceId);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: updErr.code === "42501" ? 403 : 400 });
  }

  return NextResponse.json({
    latitude: coords.latitude,
    longitude: coords.longitude,
  });
}
