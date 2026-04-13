import { collectImportableLinksFromPage } from "@/services/url-import-service";
import { resolveRequestActor } from "@/lib/resolve-request-actor";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const actor = await resolveRequestActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pageUrl = typeof body.page_url === "string" ? body.page_url : "";
  if (!pageUrl.trim()) {
    return NextResponse.json({ error: "Provide a source page URL." }, { status: 400 });
  }

  try {
    const candidates = await collectImportableLinksFromPage(pageUrl);
    return NextResponse.json({ candidates }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not collect links from page.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
