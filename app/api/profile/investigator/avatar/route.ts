import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function extForMime(mime: string): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/gif") return "gif";
  return "bin";
}

/** Upload investigator avatar image (registered users only). Replaces URL-based entry. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Missing file field" }, { status: 400 });
  }

  if (!ALLOWED.has(file.type)) {
    return NextResponse.json(
      { error: "Use JPEG, PNG, WebP, or GIF for your avatar image." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be 2 MB or smaller." }, { status: 400 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const ext = extForMime(file.type);
  const path = `${user.id}/${randomUUID()}.${ext}`;

  const { data: existing } = await supabase
    .from("profiles")
    .select("investigator_avatar_url")
    .eq("id", user.id)
    .maybeSingle();
  const prevUrl = (existing?.investigator_avatar_url as string | null)?.trim();

  const { error: upErr } = await supabase.storage.from("avatars").upload(path, buf, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 400 });
  }

  const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
  const publicUrl = pub.publicUrl;

  const { error: dbErr } = await supabase
    .from("profiles")
    .update({ investigator_avatar_url: publicUrl })
    .eq("id", user.id);
  if (dbErr) {
    await supabase.storage.from("avatars").remove([path]);
    return NextResponse.json({ error: dbErr.message }, { status: 500 });
  }

  if (prevUrl && prevUrl.includes("/avatars/")) {
    try {
      const i = prevUrl.indexOf("/avatars/");
      if (i !== -1) {
        const pathInBucket = prevUrl.slice(i + "/avatars/".length).split("?")[0];
        if (pathInBucket) {
          await supabase.storage.from("avatars").remove([decodeURIComponent(pathInBucket)]);
        }
      }
    } catch {
      /* ignore cleanup failure */
    }
  }

  return NextResponse.json({ ok: true, investigator_avatar_url: publicUrl });
}
