import { EvidenceDuplicateError } from "@/lib/evidence-upload-errors";
import { buildDuplicateEvidenceResponse } from "@/services/duplicate-evidence-response";
import { ingestEvidenceFromUrl } from "@/services/case-evidence-ingest";
import { normalizeEvidenceSourcePayload, type EvidenceSourceType } from "@/lib/evidence-source";
import { requestClientIp, requestUserAgent } from "@/lib/request-audit";
import { resolveRequestActor } from "@/lib/resolve-request-actor";
import { logUsageEvent } from "@/services/usage-log-service";
import { isPlatformDeleteAdmin } from "@/lib/admin-guard";
import { parsePublicHttpUrl } from "@/lib/url-import-utils";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type UrlImportItemResponse = {
  url: string;
  id?: string;
  warning?: string;
  duplicate?: boolean;
  existing?: unknown;
  needs_extraction?: boolean;
  message?: string;
  error?: string;
  import_status: "imported" | "duplicate_skipped" | "failed";
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ caseId: string }> },
) {
  const { caseId } = await params;
  const actor = await resolveRequestActor();
  if (!actor || actor.mode !== "user") {
    return NextResponse.json({ error: "Sign in to import evidence into a case." }, { status: 401 });
  }
  const supabase = actor.supabase;
  const user = { id: actor.userId };

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = typeof body.url === "string" ? body.url : "";
  const urls =
    Array.isArray(body.urls) && body.urls.length
      ? body.urls.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
      : url.trim()
        ? [url.trim()]
        : [];
  if (!urls.length) {
    return NextResponse.json({ error: "Provide at least one URL to import." }, { status: 400 });
  }
  const isBatchRequest = Array.isArray(body.urls);
  const requestedForceDuplicate = body.force_duplicate === true || body.force_duplicate === "true";
  const forceDuplicate =
    requestedForceDuplicate &&
    isPlatformDeleteAdmin((await supabase.auth.getUser()).data.user ?? null);

  const source = normalizeEvidenceSourcePayload({
    source_type:
      typeof body.source_type === "string" ? (body.source_type as EvidenceSourceType) : "article",
    source_platform: typeof body.source_platform === "string" ? body.source_platform : undefined,
    source_program: typeof body.source_program === "string" ? body.source_program : undefined,
    source_url: typeof body.source_url === "string" && body.source_url.trim() ? body.source_url : undefined,
  });

  const uploaderIp = requestClientIp(request);
  const userAgent = requestUserAgent(request);

  const results: UrlImportItemResponse[] = [];
  for (const currentUrl of urls) {
    try {
      const normalizedUrl = parsePublicHttpUrl(currentUrl).href;
      const r = await ingestEvidenceFromUrl(supabase, {
        caseId,
        userId: user.id,
        url: normalizedUrl,
        source: { ...source, source_url: source.source_url?.trim() || normalizedUrl },
        forceDuplicate,
        audit: { uploaderIp, userAgent, uploadMethod: "url_import" },
      });
      await logUsageEvent({
        userId: user.id,
        action: "evidence.url_import",
        meta: { scope: "case", caseId, url: normalizedUrl },
      });
      results.push({
        url: normalizedUrl,
        id: r.id,
        warning: r.warning,
        import_status: "imported",
      });
    } catch (e) {
      if (e instanceof EvidenceDuplicateError) {
        const dupBody = await buildDuplicateEvidenceResponse(supabase, e);
        results.push({
          ...dupBody,
          url: currentUrl,
          import_status: "duplicate_skipped",
        });
        continue;
      }
      const message = e instanceof Error ? e.message : "Import failed";
      results.push({ url: currentUrl, error: message, import_status: "failed" });
    }
  }

  if (!isBatchRequest && results.length === 1) {
    const single = results[0];
    if (single.duplicate) {
      return NextResponse.json(single, { status: 200 });
    }
    if (single.error) {
      return NextResponse.json({ error: single.error }, { status: 400 });
    }
    return NextResponse.json(
      {
        id: single.id,
        ...(single.warning ? { warning: single.warning } : {}),
      },
      { status: 201 },
    );
  }

  return NextResponse.json({ results }, { status: 200 });
}
