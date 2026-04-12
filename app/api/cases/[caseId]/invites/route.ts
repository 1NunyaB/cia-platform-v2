import { createClient } from "@/lib/supabase/server";
import { inviteToCase } from "@/services/case-service";
import { NextResponse } from "next/server";
import { z } from "zod";

const bodySchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "contributor", "viewer"]),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  try {
    const result = await inviteToCase(supabase, {
      caseId,
      email: parsed.data.email,
      role: parsed.data.role,
      invitedBy: user.id,
    });
    const base =
      request.headers.get("origin") ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      "";
    return NextResponse.json({
      ...result,
      inviteUrl: base ? `${base}/invite/${result.token}` : null,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invite failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
