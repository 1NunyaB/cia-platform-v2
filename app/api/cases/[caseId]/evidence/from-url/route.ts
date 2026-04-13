import { EvidenceDuplicateError } from "@/lib/evidence-upload-errors";
import { buildDuplicateEvidenceResponse } from "@/services/duplicate-evidence-response";
import { ingestEvidenceFromUrl } from "@/services/case-evidence-ingest";
import { normalizeEvidenceSourcePayload, type EvidenceSourceType } from "@/lib/evidence-source";
import { requestClientIp, requestUserAgent } from "@/lib/request-audit";
import { resolveRequestActor } from "@/lib/resolve-request-actor";
import { logUsageEvent } from "@/services/usage-log-service";
import { deferExtractionFromJsonBody } from "@/lib/evidence-defer-extraction";
import { isPlatformDeleteAdmin } from "@/lib/admin-guard";
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
  deferred_extraction?: boolean;
  error?: string;
  import_status:
    | "imported"
    | "duplicate_skipped"
    | "extraction_queued"
    | "extraction_complete"
    | "extraction_partial"
    | "extraction_failed";
};

function classifyImportStatus(payload: { warning?: string; deferred_extraction?: boolean }) {
  if (payload.deferred_extraction) return "extraction_queued" as const;
  if (!payload.warning) return "extraction_complete" as const;
  if (payload.warning.includes("Text extraction was not possible")) return "extraction_failed" as const;
  if (payload.warning.toLowerCase().includes("placeholder") || payload.warning.toLowerCase().includes("missing")) {
    return "extraction_partial" as const;
  }
  return "imported" as const;
}

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
  const deferExtraction = deferExtractionFromJsonBody(body);

  const results: UrlImportItemResponse[] = [];
  for (const currentUrl of urls) {
    try {
      const r = await ingestEvidenceFromUrl(supabase, {
        caseId,
        userId: user.id,
        url: currentUrl,
        source: { ...source, source_url: source.source_url?.trim() || currentUrl },
        forceDuplicate,
        deferExtraction,
        audit: { uploaderIp, userAgent, uploadMethod: "url_import" },
      });
      await logUsageEvent({
        userId: user.id,
        action: "evidence.url_import",
        meta: { scope: "case", caseId, url: currentUrl },
      });
      results.push({
        url: currentUrl,
        id: r.id,
        warning: r.warning,
        ...(r.deferred_extraction ? { deferred_extraction: true } : {}),
        import_status: classifyImportStatus({ warning: r.warning, deferred_extraction: r.deferred_extraction }),
      });
    } catch (e) {
      if (e instanceof EvidenceDuplicateError) {
        const dupBody = await buildDuplicateEvidenceResponse(supabase, e);
        results.push({
          url: currentUrl,
          duplicate: true,
          import_status: "duplicate_skipped",
          ...dupBody,
        });
        continue;
      }
      const message = e instanceof Error ? e.message : "Import failed";
      results.push({ url: currentUrl, error: message, import_status: "extraction_failed" });
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
    const legacy = {
      id: single.id,
      ...(single.warning ? { warning: single.warning } : {}),
      ...(single.deferred_extraction ? { deferred_extraction: true } : {}),
    };
    return NextResponse.json(legacy, { status: 201 });
  }

  return NextResponse.json({ results }, { status: 200 });
}
