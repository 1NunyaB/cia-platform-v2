import { createClient } from "@/lib/supabase/server";
import { isInvestigationStackKind } from "@/lib/investigation-stacks";
import type { InvestigationStackKind } from "@/lib/investigation-stacks";
import { EvidenceDuplicateError } from "@/lib/evidence-upload-errors";
import { buildDuplicateEvidenceResponse } from "@/services/duplicate-evidence-response";
import {
  assertEvidenceLinkedToCase,
  ingestPdfPageDerivatives,
} from "@/services/case-evidence-ingest";
import {
  addEvidenceToInvestigationStack,
  ensureInvestigationStacksForCase,
} from "@/services/investigation-stack-service";
import { requestClientIp, requestUserAgent } from "@/lib/request-audit";
import { logUsageEvent } from "@/services/usage-log-service";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Create one evidence file per selected PDF page (`original__p0001.pdf`, …).
 * Optional `clusterId` + `caseId` adds each new file to that stack after creation.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ evidenceId: string }> },
) {
  const { evidenceId: sourceEvidenceId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { pages?: unknown; clusterId?: unknown; caseId?: unknown; stackKinds?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const pages = body.pages;
  if (!Array.isArray(pages)) {
    return NextResponse.json({ error: "pages must be an array of page numbers" }, { status: 400 });
  }

  const clusterId =
    typeof body.clusterId === "string" && body.clusterId.trim() ? body.clusterId.trim() : null;
  const caseIdForCluster =
    typeof body.caseId === "string" && body.caseId.trim() ? body.caseId.trim() : null;

  const rawStackKinds = Array.isArray(body.stackKinds) ? body.stackKinds : [];
  const stackKinds = rawStackKinds
    .map((k) => String(k).trim().toLowerCase())
    .filter((k): k is InvestigationStackKind => isInvestigationStackKind(k));

  if (clusterId && !caseIdForCluster) {
    return NextResponse.json({ error: "caseId is required when clusterId is set" }, { status: 400 });
  }
  if (stackKinds.length > 0 && !caseIdForCluster) {
    return NextResponse.json({ error: "caseId is required when stackKinds is set" }, { status: 400 });
  }

  const uploaderIp = requestClientIp(request);
  const userAgent = requestUserAgent(request);

  try {
    if (stackKinds.length > 0 && caseIdForCluster) {
      await assertEvidenceLinkedToCase(supabase, sourceEvidenceId, caseIdForCluster);
    }

    const { created } = await ingestPdfPageDerivatives(supabase, {
      sourceEvidenceId,
      userId: user.id,
      pageNumbers: pages as number[],
      clusterId,
      caseIdForCluster,
      audit: { uploaderIp, userAgent },
    });

    if (stackKinds.length > 0 && caseIdForCluster && created.length > 0) {
      const clusterByKind = await ensureInvestigationStacksForCase(supabase, caseIdForCluster);
      for (const row of created) {
        for (const kind of stackKinds) {
          const cid = clusterByKind.get(kind);
          if (!cid) continue;
          try {
            await addEvidenceToInvestigationStack(supabase, {
              clusterId: cid,
              evidenceFileId: row.id,
            });
          } catch (e) {
            console.warn("[pdf-pages] stack attach:", kind, e);
          }
        }
      }
    }

    await logUsageEvent({
      userId: user.id,
      action: "evidence.upload",
      meta: { scope: "pdf_pages", sourceEvidenceId, count: created.length },
    });
    return NextResponse.json({ created }, { status: 201 });
  } catch (e) {
    if (e instanceof EvidenceDuplicateError) {
      const dupBody = await buildDuplicateEvidenceResponse(supabase, e);
      return NextResponse.json(dupBody, { status: 200 });
    }
    const message = e instanceof Error ? e.message : "PDF page extract failed";
    const status =
      message.includes("not found") || message.includes("Source evidence")
        ? 404
        : message.includes("not linked") ||
            message.includes("Stack not found") ||
            message.includes("memberships unavailable")
          ? 403
          : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
