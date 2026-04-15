import { createClient } from "@/lib/supabase/server";
import { isImageCategoryName } from "@/lib/image-categories";
import { listEvidenceForImageHub } from "@/services/evidence-service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Image Analysis hub: list current user's image evidence, optionally filtered by `image_category`.
 * Query: `?category=location` (optional)
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const raw = searchParams.get("category");
  let category: string | null = null;
  if (raw != null && raw.trim() !== "") {
    const n = raw.trim().toLowerCase();
    if (!isImageCategoryName(n)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    category = n;
  }

  try {
    const evidence = await listEvidenceForImageHub(supabase, { imageCategory: category });
    return NextResponse.json({ evidence });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to load evidence";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
