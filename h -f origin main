import { NextResponse } from "next/server";
import { z } from "zod";

export const runtime = "nodejs";

const SuggestionSchema = z.object({
  name: z.string().trim().max(120).optional().nullable(),
  email: z.string().trim().email().optional().nullable(),
  subject: z.string().trim().max(200).optional().nullable(),
  message: z.string().trim().min(1).max(5000),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = SuggestionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Invalid suggestion submission." },
        { status: 400 }
      );
    }

    console.log("[suggestion submitted]", {
      name: parsed.data.name || null,
      email: parsed.data.email || null,
      subject: parsed.data.subject || null,
      message: parsed.data.message,
      submittedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      ok: true,
      message: "Suggestion received.",
    });
  } catch (error) {
    console.error("[suggestion route error]", error);

    return NextResponse.json(
      { ok: false, error: "Suggestion could not be submitted." },
      { status: 500 }
    );
  }
}