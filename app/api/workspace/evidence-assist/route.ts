import { NextResponse } from "next/server";
import type { AppSupabaseClient } from "@/types";
import { resolveRequestActor } from "@/lib/resolve-request-actor";
import { evidencePrimaryLabel } from "@/lib/evidence-display-alias";
import {
  EVIDENCE_BUCKET,
  getEvidenceById,
  getGuestEvidenceById,
  isEvidenceCaseMembershipTableError,
} from "@/services/evidence-service";
import { getCaseById } from "@/services/case-service";
import { AiNotConfiguredError } from "@/lib/openai-config";
import {
  evaluateWorkspaceAiMessagePolicy,
  WORKSPACE_AI_SCOPE_REFUSAL,
} from "@/lib/workspace-ai-scope-policy";
import {
  AVAILABLE_CAPABILITIES,
  evaluateCapabilityRequest,
  type WorkspacePageContext,
} from "@/lib/workspace-ai-capabilities";
import {
  runWorkspaceEvidenceAssist,
  type WorkspaceEvidenceMeta,
} from "@/services/workspace-evidence-assist-service";

const AI_USER_MESSAGE = "AI is not configured yet.";

export const runtime = "nodejs";

const VISION_MAX_BYTES = 4 * 1024 * 1024;
/** Max files per assist request (metadata + optional image previews). */
const MAX_EVIDENCE_ASSIST_IDS = 15;
/** Max image previews attached to one request (token / latency guard). */
const MAX_VISION_ATTACHMENTS = 4;

function rowToMeta(row: Record<string, unknown>, evidenceId: string): WorkspaceEvidenceMeta {
  return {
    id: evidenceId,
    label: evidencePrimaryLabel({
      display_filename: (row.display_filename as string | null) ?? null,
      original_filename: (row.original_filename as string) ?? evidenceId,
    }),
    mimeType: (row.mime_type as string | null) ?? null,
    processingStatus: (row.processing_status as string | null) ?? null,
    sourceType: (row.source_type as string | null) ?? null,
    sourcePlatform: (row.source_platform as string | null) ?? null,
    sourceProgram: (row.source_program as string | null) ?? null,
    originalFilename: String(row.original_filename ?? ""),
    shortAlias: (row.short_alias as string | null)?.trim() || null,
    fileSequenceNumber: (() => {
      const n = Number(row.file_sequence_number);
      return Number.isFinite(n) ? n : null;
    })(),
  };
}

async function loadEvidenceRow(
  actor: NonNullable<Awaited<ReturnType<typeof resolveRequestActor>>>,
  evidenceId: string,
) {
  if (actor.mode === "user") {
    return getEvidenceById(actor.supabase, evidenceId);
  }
  return getGuestEvidenceById(actor.service, evidenceId, actor.guestSessionId);
}

async function evidenceBelongsToCase(
  supabase: AppSupabaseClient,
  evidenceId: string,
  caseId: string,
  evidenceCaseId: string | null,
): Promise<boolean> {
  if (evidenceCaseId === caseId) return true;
  const res = await supabase
    .from("evidence_case_memberships")
    .select("evidence_file_id")
    .eq("case_id", caseId)
    .eq("evidence_file_id", evidenceId)
    .maybeSingle();
  if (res.error && isEvidenceCaseMembershipTableError(res.error)) {
    return false;
  }
  return !res.error && res.data != null;
}

function parseEvidenceIdsFromSearch(url: URL): string[] {
  const csv = url.searchParams.get("evidenceIds")?.trim();
  if (csv) {
    const parts = csv
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    return [...new Set(parts)];
  }
  const single = url.searchParams.get("evidenceId")?.trim() ?? "";
  return single ? [single] : [];
}

/** GET ?evidenceId= or ?evidenceIds=id1,id2 — sidebar chip metadata (no extraction). */
export async function GET(request: Request) {
  const actor = await resolveRequestActor();
  if (!actor) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const ids = parseEvidenceIdsFromSearch(url);
  if (ids.length === 0) {
    return NextResponse.json({ error: "evidenceId or evidenceIds is required" }, { status: 400 });
  }
  if (ids.length > MAX_EVIDENCE_ASSIST_IDS) {
    return NextResponse.json({ error: `At most ${MAX_EVIDENCE_ASSIST_IDS} evidence items.` }, { status: 400 });
  }

  const items: Array<WorkspaceEvidenceMeta & { caseId: string | null; compareHref: string }> = [];
  for (const evidenceId of ids) {
    const row = await loadEvidenceRow(actor, evidenceId);
    if (!row) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
    }
    const meta = rowToMeta(row as Record<string, unknown>, evidenceId);
    const caseId = (row.case_id as string | null) ?? null;
    items.push({
      ...meta,
      caseId,
      compareHref: `/evidence/compare?a=${encodeURIComponent(evidenceId)}`,
    });
  }

  return NextResponse.json({ items });
}

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

  const message = typeof body.message === "string" ? body.message.trim() : "";
  const caseIdParam = typeof body.caseId === "string" ? body.caseId.trim() : null;
  const pageContext =
    typeof body.pageContext === "string" ? (body.pageContext as WorkspacePageContext) : ("other" as WorkspacePageContext);

  const rawIds = Array.isArray(body.evidenceIds) ? body.evidenceIds : null;
  const evidenceIds = rawIds
    ? [...new Set(rawIds.map((x) => String(x).trim()).filter(Boolean))]
    : null;
  const legacyId = typeof body.evidenceId === "string" ? body.evidenceId.trim() : "";

  const ids =
    evidenceIds && evidenceIds.length > 0 ? evidenceIds : legacyId ? [legacyId] : [];

  if (ids.length === 0 || !message) {
    return NextResponse.json(
      { error: "evidenceId or evidenceIds (non-empty) and message are required" },
      { status: 400 },
    );
  }
  if (ids.length > MAX_EVIDENCE_ASSIST_IDS) {
    return NextResponse.json({ error: `At most ${MAX_EVIDENCE_ASSIST_IDS} evidence items.` }, { status: 400 });
  }
  if (message.length > 8000) {
    return NextResponse.json({ error: "message is too long" }, { status: 400 });
  }
  const policy = evaluateWorkspaceAiMessagePolicy(message);
  if (policy?.blocked) {
    console.warn("[evidence-assist] policy refusal", {
      reason: policy.reason,
      messageLength: message.length,
      itemCount: ids.length,
    });
    return NextResponse.json({
      reply: WORKSPACE_AI_SCOPE_REFUSAL,
      policyRefusal: true,
      policyReason: policy.reason,
    });
  }
  const capability = evaluateCapabilityRequest(message);
  if (capability?.blocked) {
    return NextResponse.json({
      reply: capability.reply,
      capabilityRefusal: true,
      availableCapabilities: AVAILABLE_CAPABILITIES,
    });
  }

  const client = actor.mode === "user" ? actor.supabase : actor.service;
  const metas: WorkspaceEvidenceMeta[] = [];
  const rows: Record<string, unknown>[] = [];

  for (const evidenceId of ids) {
    const row = await loadEvidenceRow(actor, evidenceId);
    if (!row) {
      return NextResponse.json({ error: "Evidence not found" }, { status: 404 });
    }
    const r = row as Record<string, unknown>;
    const ps = String(r.processing_status ?? "");
    if (ps === "blocked") {
      return NextResponse.json(
        { error: `Evidence ${evidenceId.slice(0, 8)}… was blocked and cannot be used.` },
        { status: 400 },
      );
    }
    rows.push(r);
    metas.push(rowToMeta(r, evidenceId));
  }

  let caseContext: string | null = null;

  if (caseIdParam && actor.mode === "user") {
    const titleParts: string[] = [];
    try {
      const caseRow = await getCaseById(actor.supabase, caseIdParam);
      if (caseRow) {
        const title = (caseRow.title as string | null)?.trim() || "Untitled investigation";
        titleParts.push(`Workspace case id: ${caseIdParam}`, `Workspace case title: ${title}`);
      } else {
        titleParts.push(`Workspace case id: ${caseIdParam} (not found)`);
      }
    } catch {
      titleParts.push(`Workspace case id: ${caseIdParam}`);
    }
    const membershipLines: string[] = [];
    for (let i = 0; i < ids.length; i++) {
      const evidenceId = ids[i]!;
      const r = rows[i]!;
      const evidenceCaseId = (r.case_id as string | null) ?? null;
      const belongs = await evidenceBelongsToCase(actor.supabase, evidenceId, caseIdParam, evidenceCaseId);
      membershipLines.push(
        `- ${metas[i]!.label} (${evidenceId.slice(0, 8)}…): ${belongs ? "linked to this case" : "not linked to this case (metadata only)"}`,
      );
    }
    caseContext = [...titleParts, `Current page context: ${pageContext}`, "Selection vs workspace case:", ...membershipLines].join("\n");
  } else if (caseIdParam && actor.mode === "guest") {
    caseContext = `Workspace case id: ${caseIdParam} (guest session — limited context)`;
  } else if (actor.mode === "user") {
    const perFileCase = new Map<string, string>();
    for (let i = 0; i < ids.length; i++) {
      const cid = (rows[i]!.case_id as string | null) ?? null;
      if (!cid) continue;
      if (perFileCase.has(cid)) continue;
      try {
        const cr = await getCaseById(actor.supabase, cid);
        const t = cr ? (cr.title as string | null)?.trim() || "Untitled investigation" : "Unknown";
        perFileCase.set(cid, t);
      } catch {
        perFileCase.set(cid, "(title unavailable)");
      }
    }
    if (perFileCase.size > 0) {
      caseContext = [
        `Current page context: ${pageContext}`,
        "Files may belong to different matters. Per-file case (when known):",
        ...[...perFileCase.entries()].map(([id, t]) => `- Case ${id.slice(0, 8)}… — ${t}`),
      ].join("\n");
    } else {
      caseContext = `Current page context: ${pageContext}`;
    }
  }

  const visionImages: Array<{ evidenceId: string; base64: string; mimeType: string }> = [];
  let visionCount = 0;
  for (let i = 0; i < ids.length; i++) {
    if (visionCount >= MAX_VISION_ATTACHMENTS) break;
    const evidenceId = ids[i]!;
    const r = rows[i]!;
    const mime = String((metas[i]!.mimeType ?? "")).toLowerCase();
    if (!mime.startsWith("image/") || !r.storage_path) continue;
    try {
      const { data: bin, error: dlErr } = await client.storage
        .from(EVIDENCE_BUCKET)
        .download(r.storage_path as string);
      if (dlErr || !bin) continue;
      const buf = Buffer.from(await bin.arrayBuffer());
      if (buf.length === 0 || buf.length > VISION_MAX_BYTES) continue;
      const sub = mime.split("/")[1] ?? "jpeg";
      const safeMime = sub.match(/^[a-z0-9+.-]+$/i) ? `image/${sub}` : "image/jpeg";
      visionImages.push({
        evidenceId,
        base64: buf.toString("base64"),
        mimeType: safeMime,
      });
      visionCount++;
    } catch {
      /* skip */
    }
  }

  try {
    const reply = await runWorkspaceEvidenceAssist({
      userMessage: message,
      evidence: metas.length === 1 ? metas[0]! : metas,
      caseContext,
      pageContext,
      visionImages: visionImages.length > 0 ? visionImages : undefined,
    });
    return NextResponse.json({
      reply,
      usedVision: visionImages.length > 0,
      evidenceLabel: metas.map((m) => m.label).join("; "),
    });
  } catch (e) {
    if (e instanceof AiNotConfiguredError) {
      console.error("[evidence-assist] AI not configured or OpenAI request rejected");
      return NextResponse.json({ error: AI_USER_MESSAGE, code: "ai_unconfigured" }, { status: 503 });
    }
    const msg = e instanceof Error ? e.message : "Assist failed";
    console.error("[evidence-assist] unexpected error:", msg);
    return NextResponse.json({ error: AI_USER_MESSAGE, code: "ai_unavailable" }, { status: 503 });
  }
}
