import { EvidenceDuplicateError } from "@/lib/evidence-upload-errors";
import { buildDuplicateEvidenceResponse } from "@/services/duplicate-evidence-response";
import { ingestEvidenceFromUrl } from "@/services/case-evidence-ingest";
import { ingestGuestEvidenceFromUrl } from "@/services/guest-evidence-ingest";
import { normalizeEvidenceSourcePayload, type EvidenceSourceType } from "@/lib/evidence-source";
import { requestClientIp, requestUserAgent } from "@/lib/request-audit";
import { resolveRequestActor } from "@/lib/resolve-request-actor";
import { logUsageEvent } from "@/services/usage-log-service";
import { touchGuestSession } from "@/services/guest-session-service";
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

  const url = typeof body.url === "string" ? body.url : "";
  const rawUrls =
    Array.isArray(body.urls) && body.urls.length
      ? body.urls.filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean)
      : url.trim()
        ? [url.trim()]
        : [];
  if (!rawUrls.length) {
    return NextResponse.json({ error: "Provide at least one URL to import." }, { status: 400 });
  }
  const urls = rawUrls;
  const isBatchRequest = Array.isArray(body.urls);
  const requestedForceDuplicate = body.force_duplicate === true || body.force_duplicate === "true";
  const forceDuplicate =
    actor.mode === "user"
      ? requestedForceDuplicate &&
        isPlatformDeleteAdmin((await actor.supabase.auth.getUser()).data.user ?? null)
      : false;

  const source = normalizeEvidenceSourcePayload({
    source_type:
      typeof body.source_type === "string" ? (body.source_type as EvidenceSourceType) : "article",
    source_platform: typeof body.source_platform === "string" ? body.source_platform : undefined,
    source_program: typeof body.source_program === "string" ? body.source_program : undefined,
    source_url: typeof body.source_url === "string" && body.source_url.trim() ? body.source_url : undefined,
  });

  const uploaderIp = requestClientIp(request);
  const userAgent = requestUserAgent(request);
  const selectedCaseId = typeof body.case_id === "string" && body.case_id.trim() ? body.case_id.trim() : null;

  if (actor.mode === "user" && !selectedCaseId) {
    return NextResponse.json(
      { error: "Import failed — no case selected. Please select or create a case before importing." },
      { status: 400 },
    );
  }
  if (actor.mode === "user" && selectedCaseId) {
    const [createdCaseCheck, membershipCaseCheck] = await Promise.all([
      actor.supabase
        .from("cases")
        .select("id")
        .eq("id", selectedCaseId)
        .eq("created_by", actor.userId)
        .maybeSingle(),
      actor.supabase
        .from("case_members")
        .select("case_id")
        .eq("case_id", selectedCaseId)
        .eq("user_id", actor.userId)
        .maybeSingle(),
    ]);
    if (createdCaseCheck.error || membershipCaseCheck.error) {
      return NextResponse.json({ error: "Could not validate selected case for import." }, { status: 400 });
    }
    if (!createdCaseCheck.data && !membershipCaseCheck.data) {
      return NextResponse.json({ error: "Selected case is not available to your account." }, { status: 403 });
    }
  }

  const results: UrlImportItemResponse[] = [];
  for (const currentUrl of urls) {
    try {
      const normalizedUrl = parsePublicHttpUrl(currentUrl).href;
      if (actor.mode === "user") {
        const r = await ingestEvidenceFromUrl(actor.supabase, {
          caseId: selectedCaseId,
          userId: actor.userId,
          url: normalizedUrl,
          source: { ...source, source_url: source.source_url?.trim() || normalizedUrl },
          forceDuplicate,
          audit: { uploaderIp, userAgent, uploadMethod: "url_import" },
        });
        await logUsageEvent({
          userId: actor.userId,
          action: "evidence.url_import",
          meta: { scope: "library", caseId: selectedCaseId, url: normalizedUrl },
        });
        results.push({
          url: normalizedUrl,
          id: r.id,
          warning: r.warning,
          import_status: "imported",
        });
      } else {
        const r = await ingestGuestEvidenceFromUrl(actor.service, {
          guestSessionId: actor.guestSessionId,
          url: normalizedUrl,
          source: { ...source, source_url: source.source_url?.trim() || normalizedUrl },
          forceDuplicate,
          audit: { uploaderIp, userAgent, uploadMethod: "url_import" },
        });
        await touchGuestSession(actor.service, actor.guestSessionId);
        await logUsageEvent({
          guestSessionId: actor.guestSessionId,
          action: "evidence.url_import",
          meta: { scope: "library", url: normalizedUrl },
        });
        results.push({
          url: normalizedUrl,
          id: r.id,
          warning: r.warning,
          import_status: "imported",
        });
      }
    } catch (e) {
      if (e instanceof EvidenceDuplicateError) {
        const dupClient = actor.mode === "user" ? actor.supabase : actor.service;
        const dupBody = await buildDuplicateEvidenceResponse(dupClient, e);
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
    const legacy = {
      id: single.id,
      ...(single.warning ? { warning: single.warning } : {}),
    };
    return NextResponse.json(legacy, { status: 201 });
  }

  return NextResponse.json({ results }, { status: 200 });
}
