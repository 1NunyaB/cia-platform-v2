import type {
  AppSupabaseClient,
  EvidenceUploadMethod,
  ExtractedText,
  ExtractionMethod,
  LocationMapPinRow,
} from "@/types";
import type { EvidenceSourcePayload } from "@/lib/evidence-source";
import type { DuplicateEvidenceMatch } from "@/lib/evidence-upload-errors";
import { buildDisplayFilename, composeShortAlias, deriveUploadAliasSeed } from "@/lib/evidence-display-alias";
import { logActivity } from "@/services/activity-service";
import { recordContribution } from "@/services/contributions-service";
import { resolveAndEnsureSourcePlatform } from "@/services/source-platform-catalog";
import { isExtractionPlaceholderText } from "@/lib/extraction-messages";
import { inferSuggestedEvidenceKind, type EvidenceKind } from "@/lib/evidence-kind";

export const EVIDENCE_BUCKET = "evidence";

/** PostgREST when `evidence_case_memberships` exists in migrations but not on the linked DB. */
export function isEvidenceCaseMembershipTableError(err: { message?: string } | null | undefined): boolean {
  const m = err?.message ?? "";
  return m.includes("evidence_case_memberships");
}

/**
 * Storage layout: case uploads use `{caseId}/{evidenceId}/{file}`.
 * Library (no case) uses `library/{userId}/{evidenceId}/{file}` so objects stay addressable before assignment.
 */
/**
 * Evidence bucket paths. Optional `imageCategory` nests under `images/{category}/` (see migration 049).
 * Example library: `images/location/library/{userId}/{evidenceId}/file.jpg`
 * Example case: `images/location/{caseId}/{evidenceId}/file.jpg`
 */
export function buildStoragePath(
  caseId: string | null,
  userId: string,
  evidenceId: string,
  filename: string,
  imageCategory?: string | null,
) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const prefix =
    imageCategory && /^[a-z_]+$/.test(imageCategory) ? `images/${imageCategory}/` : "";
  if (caseId) {
    return `${prefix}${caseId}/${evidenceId}/${safe}`;
  }
  return `${prefix}library/${userId}/${evidenceId}/${safe}`;
}

/** Guest library objects: isolated under session id (service-role uploads). */
export function buildGuestLibraryStoragePath(guestSessionId: string, evidenceId: string, filename: string) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `library/guest/${guestSessionId}/${evidenceId}/${safe}`;
}

/** Find an existing row the current user can see (RLS) — SHA-256 match, or legacy same-name+size for same uploader. */
export async function findDuplicateEvidence(
  supabase: AppSupabaseClient,
  input: {
    contentSha256: string;
    originalFilename: string;
    fileSize: number | null;
    uploadedByUserId: string;
  },
): Promise<DuplicateEvidenceMatch | null> {
  const { data: byHash, error: hErr } = await supabase
    .from("evidence_files")
    .select(
      "id, original_filename, display_filename, short_alias, case_id, processing_status, mime_type, error_message",
    )
    .eq("content_sha256", input.contentSha256)
    .limit(1)
    .maybeSingle();
  if (hErr) throw new Error(hErr.message);
  if (byHash) {
    return {
      id: byHash.id as string,
      original_filename: byHash.original_filename as string,
      display_filename: (byHash.display_filename as string | null) ?? null,
      short_alias: (byHash.short_alias as string | null) ?? null,
      case_id: (byHash.case_id as string | null) ?? null,
      processing_status: (byHash.processing_status as string | null) ?? null,
      mime_type: (byHash.mime_type as string | null) ?? null,
      error_message: (byHash.error_message as string | null) ?? null,
    };
  }

  if (input.fileSize != null && input.fileSize >= 0) {
    const { data: legacy, error: lErr } = await supabase
      .from("evidence_files")
      .select(
        "id, original_filename, display_filename, short_alias, case_id, processing_status, mime_type, error_message",
      )
      .eq("original_filename", input.originalFilename)
      .eq("file_size", input.fileSize)
      .eq("uploaded_by", input.uploadedByUserId)
      .is("content_sha256", null)
      .limit(1)
      .maybeSingle();
    if (lErr) throw new Error(lErr.message);
    if (legacy) {
      return {
        id: legacy.id as string,
        original_filename: legacy.original_filename as string,
        display_filename: (legacy.display_filename as string | null) ?? null,
        short_alias: (legacy.short_alias as string | null) ?? null,
        case_id: (legacy.case_id as string | null) ?? null,
        processing_status: (legacy.processing_status as string | null) ?? null,
        mime_type: (legacy.mime_type as string | null) ?? null,
        error_message: (legacy.error_message as string | null) ?? null,
      };
    }
  }

  return null;
}

/** Duplicate detection for guest library uploads (same session + fingerprint). */
export async function findDuplicateGuestEvidence(
  supabase: AppSupabaseClient,
  input: {
    guestSessionId: string;
    contentSha256: string;
    originalFilename: string;
    fileSize: number | null;
  },
): Promise<DuplicateEvidenceMatch | null> {
  const { data: byHash, error: hErr } = await supabase
    .from("evidence_files")
    .select(
      "id, original_filename, display_filename, short_alias, case_id, processing_status, mime_type, error_message",
    )
    .eq("content_sha256", input.contentSha256)
    .eq("guest_session_id", input.guestSessionId)
    .limit(1)
    .maybeSingle();
  if (hErr) throw new Error(hErr.message);
  if (byHash) {
    return {
      id: byHash.id as string,
      original_filename: byHash.original_filename as string,
      display_filename: (byHash.display_filename as string | null) ?? null,
      short_alias: (byHash.short_alias as string | null) ?? null,
      case_id: (byHash.case_id as string | null) ?? null,
      processing_status: (byHash.processing_status as string | null) ?? null,
      mime_type: (byHash.mime_type as string | null) ?? null,
      error_message: (byHash.error_message as string | null) ?? null,
    };
  }

  if (input.fileSize != null && input.fileSize >= 0) {
    const { data: legacy, error: lErr } = await supabase
      .from("evidence_files")
      .select(
        "id, original_filename, display_filename, short_alias, case_id, processing_status, mime_type, error_message",
      )
      .eq("original_filename", input.originalFilename)
      .eq("file_size", input.fileSize)
      .eq("guest_session_id", input.guestSessionId)
      .is("content_sha256", null)
      .limit(1)
      .maybeSingle();
    if (lErr) throw new Error(lErr.message);
    if (legacy) {
      return {
        id: legacy.id as string,
        original_filename: legacy.original_filename as string,
        display_filename: (legacy.display_filename as string | null) ?? null,
        short_alias: (legacy.short_alias as string | null) ?? null,
        case_id: (legacy.case_id as string | null) ?? null,
        processing_status: (legacy.processing_status as string | null) ?? null,
        mime_type: (legacy.mime_type as string | null) ?? null,
        error_message: (legacy.error_message as string | null) ?? null,
      };
    }
  }

  return null;
}

/**
 * Whether the user should be offered “Run extraction” / recovery (not currently mid-extraction).
 * Used for duplicate responses and evidence detail panels.
 */
export async function getEvidenceNeedsExtraction(
  supabase: AppSupabaseClient,
  evidenceId: string,
): Promise<boolean> {
  const ev = await getEvidenceById(supabase, evidenceId);
  if (!ev) return false;
  const status = String(ev.processing_status ?? "");
  const ex = String(
    (ev as { extraction_status?: string | null }).extraction_status ?? "pending",
  ).toLowerCase();

  if (status === "extracting") return false;
  if (status === "blocked") return false;
  if (ex === "failed" || ex === "unavailable" || ex === "retry_needed" || ex === "limited" || ex === "low_confidence") return true;
  if (status === "error") return true;
  if (status === "accepted") return true;

  const merged = await getExtractedText(supabase, evidenceId);
  const raw = merged?.raw_text != null ? String(merged.raw_text) : "";
  if (status === "complete") {
    if (ex !== "ok") return true;
    if (!raw.trim()) return true;
    if (isExtractionPlaceholderText(raw)) return true;
    return false;
  }
  if (status === "pending" || status === "scanning" || status === "analyzing") {
    return false;
  }
  return !raw.trim() || isExtractionPlaceholderText(raw);
}

export async function recordGuestEvidenceUploadAudit(
  supabase: AppSupabaseClient,
  input: {
    evidenceFileId: string;
    guestSessionId: string;
    uploaderIp?: string | null;
    userAgent?: string | null;
    uploadMethod?: EvidenceUploadMethod | null;
  },
) {
  const { error } = await supabase.from("evidence_upload_audit").insert({
    evidence_file_id: input.evidenceFileId,
    uploaded_by: null,
    guest_session_id: input.guestSessionId,
    uploader_ip: input.uploaderIp ?? null,
    user_agent: input.userAgent ?? null,
    upload_method: input.uploadMethod ?? null,
  });
  if (error) throw new Error(error.message);
}

/** Guest library evidence only (service-role client). */
export async function registerGuestEvidenceFile(
  supabase: AppSupabaseClient,
  input: {
    id?: string;
    guestSessionId: string;
    storagePath: string;
    originalFilename: string;
    mimeType: string | null;
    fileSize: number | null;
    contentSha256?: string | null;
    processingStatus?: import("@/types").EvidenceProcessingStatus;
    source?: EvidenceSourcePayload;
    audit?: {
      uploaderIp?: string | null;
      userAgent?: string | null;
      uploadMethod?: EvidenceUploadMethod | null;
    };
    suggestedEvidenceKind?: EvidenceKind | null;
  },
) {
  const src = input.source;

  let effectiveSource = src;
  if (src?.source_platform?.trim()) {
    try {
      const canon = await resolveAndEnsureSourcePlatform(supabase, src.source_platform);
      if (canon) effectiveSource = { ...src, source_platform: canon };
    } catch {
      /* Catalog unavailable — keep submitted platform string. */
    }
  }

  const { data: seqData, error: seqErr } = await supabase.rpc("next_guest_evidence_file_sequence", {
    p_guest_session_id: input.guestSessionId,
  });
  if (seqErr) throw new Error(seqErr.message);
  const sequence = Number(seqData);
  if (!Number.isFinite(sequence) || sequence < 1) {
    throw new Error("Could not allocate evidence sequence for this guest session.");
  }

  const displayFilename = buildDisplayFilename(input.originalFilename, sequence);
  const seedPack = deriveUploadAliasSeed({
    sourceProgram: effectiveSource?.source_program ?? null,
    sourcePlatform: effectiveSource?.source_platform ?? null,
    originalFilename: input.originalFilename,
  });
  const shortAlias = composeShortAlias(seedPack.base, sequence);
  const suggestedKind =
    input.suggestedEvidenceKind ?? inferSuggestedEvidenceKind(input.mimeType, input.originalFilename);

  const { data, error } = await supabase
    .from("evidence_files")
    .insert({
      ...(input.id ? { id: input.id } : {}),
      case_id: null,
      uploaded_by: null,
      guest_session_id: input.guestSessionId,
      storage_path: input.storagePath,
      original_filename: input.originalFilename,
      mime_type: input.mimeType,
      file_size: input.fileSize,
      content_sha256: input.contentSha256 ?? null,
      suggested_evidence_kind: suggestedKind,
      processing_status: input.processingStatus ?? "pending",
      file_sequence_number: sequence,
      display_filename: displayFilename,
      short_alias: shortAlias,
      alias_seed: seedPack.seed,
      alias_seed_type: seedPack.seedType,
      ...(effectiveSource
        ? {
            source_type: effectiveSource.source_type,
            source_platform: effectiveSource.source_platform,
            source_program: effectiveSource.source_program,
            source_url: effectiveSource.source_url,
          }
        : {}),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  const evidenceId = data!.id as string;

  if (input.audit) {
    await recordGuestEvidenceUploadAudit(supabase, {
      evidenceFileId: evidenceId,
      guestSessionId: input.guestSessionId,
      uploaderIp: input.audit.uploaderIp,
      userAgent: input.audit.userAgent,
      uploadMethod: input.audit.uploadMethod ?? null,
    });
  }

  await logActivity(supabase, {
    caseId: null,
    actorId: null,
    actorLabel: "Guest",
    action: "evidence.uploaded",
    entityType: "evidence_file",
    entityId: evidenceId,
    payload: {
      filename: input.originalFilename,
      short_alias: shortAlias,
      display_filename: displayFilename,
      library: true,
      guest_session_id: input.guestSessionId,
    },
  });

  return { id: evidenceId };
}

/** Evidence ids (guest session scope) whose extracted text matches. */
export async function findGuestEvidenceIdsMatchingExtractedText(
  supabase: AppSupabaseClient,
  guestSessionId: string,
  needle: string,
): Promise<Set<string>> {
  const t = needle.trim().replace(/[%_]/g, "").slice(0, 500);
  if (t.length < 2) return new Set();
  const { data: evRows, error: eErr } = await supabase
    .from("evidence_files")
    .select("id")
    .eq("guest_session_id", guestSessionId);
  if (eErr) throw new Error(eErr.message);
  const allowed = new Set((evRows ?? []).map((r) => r.id as string));
  if (allowed.size === 0) return new Set();

  const { data, error } = await supabase
    .from("extracted_texts")
    .select("evidence_file_id")
    .ilike("raw_text", `%${t}%`);
  if (error) throw new Error(error.message);
  const out = new Set<string>();
  for (const r of data ?? []) {
    const id = r.evidence_file_id as string;
    if (allowed.has(id)) out.add(id);
  }
  return out;
}

export async function listGuestEvidence(supabase: AppSupabaseClient, guestSessionId: string) {
  const { data, error } = await supabase
    .from("evidence_files")
    .select("*")
    .eq("guest_session_id", guestSessionId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getGuestEvidenceById(
  supabase: AppSupabaseClient,
  evidenceId: string,
  guestSessionId: string,
) {
  const { data, error } = await supabase
    .from("evidence_files")
    .select("*")
    .eq("id", evidenceId)
    .eq("guest_session_id", guestSessionId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

/** Evidence ids whose extracted text contains the needle (visible rows only via RLS on join path). */
export async function findEvidenceIdsMatchingExtractedText(
  supabase: AppSupabaseClient,
  needle: string,
): Promise<Set<string>> {
  const t = needle.trim().replace(/[%_]/g, "").slice(0, 500);
  if (t.length < 2) return new Set();
  const { data, error } = await supabase
    .from("extracted_texts")
    .select("evidence_file_id")
    .ilike("raw_text", `%${t}%`);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.evidence_file_id as string));
}

export async function findEvidenceIdsMatchingVisualTags(
  supabase: AppSupabaseClient,
  needle: string,
): Promise<Set<string>> {
  const t = needle.trim().replace(/[%_]/g, "").slice(0, 120);
  if (t.length < 2) return new Set();
  const { data, error } = await supabase
    .from("evidence_visual_tags")
    .select("evidence_file_id")
    .ilike("tag", `%${t}%`);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => r.evidence_file_id as string));
}

export async function findGuestEvidenceIdsMatchingVisualTags(
  supabase: AppSupabaseClient,
  guestSessionId: string,
  needle: string,
): Promise<Set<string>> {
  const t = needle.trim().replace(/[%_]/g, "").slice(0, 120);
  if (t.length < 2) return new Set();
  const { data: evRows, error: eErr } = await supabase
    .from("evidence_files")
    .select("id")
    .eq("guest_session_id", guestSessionId);
  if (eErr) throw new Error(eErr.message);
  const allowed = new Set((evRows ?? []).map((r) => r.id as string));
  if (allowed.size === 0) return new Set();
  const { data, error } = await supabase
    .from("evidence_visual_tags")
    .select("evidence_file_id")
    .ilike("tag", `%${t}%`);
  if (error) throw new Error(error.message);
  const out = new Set<string>();
  for (const r of data ?? []) {
    const id = r.evidence_file_id as string;
    if (allowed.has(id)) out.add(id);
  }
  return out;
}

export async function replaceEvidenceVisualTags(
  supabase: AppSupabaseClient,
  evidenceId: string,
  tags: Array<{ tag: string; confidence?: number | null; source?: string | null }>,
) {
  const { error: delErr } = await supabase
    .from("evidence_visual_tags")
    .delete()
    .eq("evidence_file_id", evidenceId);
  if (delErr) throw new Error(delErr.message);
  if (!tags.length) return;
  const rows = tags.map((t) => ({
    evidence_file_id: evidenceId,
    tag: t.tag,
    confidence: t.confidence ?? null,
    source: t.source ?? "heuristic",
  }));
  const { error: insErr } = await supabase.from("evidence_visual_tags").insert(rows);
  if (insErr) throw new Error(insErr.message);
}

export async function listEvidenceVisualTags(
  supabase: AppSupabaseClient,
  evidenceId: string,
): Promise<Array<{ tag: string; confidence: number | null; source: string | null }>> {
  const { data, error } = await supabase
    .from("evidence_visual_tags")
    .select("tag, confidence, source")
    .eq("evidence_file_id", evidenceId)
    .order("confidence", { ascending: false, nullsFirst: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{ tag: string; confidence: number | null; source: string | null }>;
}

/**
 * Persists request-derived upload metadata (IP, UA, method). Internal audit only — no default UI.
 * Call immediately after `evidence_files` insert for the same `evidence_file_id`.
 */
export async function recordEvidenceUploadAudit(
  supabase: AppSupabaseClient,
  input: {
    evidenceFileId: string;
    /** Auth subject id (same as session user); no FK to profiles. */
    uploadedBy: string;
    uploaderIp?: string | null;
    userAgent?: string | null;
    uploadMethod?: EvidenceUploadMethod | null;
  },
) {
  const { error } = await supabase.from("evidence_upload_audit").insert({
    evidence_file_id: input.evidenceFileId,
    uploaded_by: input.uploadedBy,
    uploader_ip: input.uploaderIp ?? null,
    user_agent: input.userAgent ?? null,
    upload_method: input.uploadMethod ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function registerEvidenceFile(
  supabase: AppSupabaseClient,
  input: {
    id?: string;
    /** When null, evidence is stored in the uploader's library (no case). */
    caseId: string | null;
    /**
     * Authenticated subject id (`auth.users.id`). Stored on `evidence_files.uploaded_by`.
     * Does not require a `profiles` row (FK removed in migration 030). Guest uploads use `registerGuestEvidenceFile`.
     */
    userId: string;
    storagePath: string;
    originalFilename: string;
    mimeType: string | null;
    fileSize: number | null;
    /** SHA-256 hex of file bytes; stored for duplicate detection. */
    contentSha256?: string | null;
    /** After AV + policy pass; defaults to legacy `pending` for other callers. */
    processingStatus?: import("@/types").EvidenceProcessingStatus;
    source?: EvidenceSourcePayload;
    /** Request-derived audit; written to `evidence_upload_audit` (not shown on default evidence UI). */
    audit?: {
      uploaderIp?: string | null;
      userAgent?: string | null;
      uploadMethod?: EvidenceUploadMethod | null;
    };
    /** Manual crop/edit derivative — provenance to root original (`__0001` chain). */
    derivedFromEvidenceId?: string | null;
    derivativeIndex?: number | null;
    /** 1-based source PDF page for `derivative_pdf_page` uploads; null otherwise. */
    derivativeSourcePage?: number | null;
    /** Override heuristic kind (defaults from MIME + filename). */
    suggestedEvidenceKind?: EvidenceKind | null;
    /** Image analysis hub folder; must match `image_categories.name` when set. */
    imageCategory?: string | null;
  },
) {
  const src = input.source;

  let effectiveSource = src;
  if (src?.source_platform?.trim()) {
    try {
      const canon = await resolveAndEnsureSourcePlatform(supabase, src.source_platform);
      if (canon) effectiveSource = { ...src, source_platform: canon };
    } catch {
      /* Catalog unavailable — keep submitted platform string. */
    }
  }

  const { data: seqData, error: seqErr } = await supabase.rpc("next_evidence_file_sequence", {
    p_case_id: input.caseId,
  });
  if (seqErr) throw new Error(seqErr.message);
  const sequence = Number(seqData);
  if (!Number.isFinite(sequence) || sequence < 1) {
    throw new Error(
      input.caseId
        ? "Could not allocate evidence sequence for this case."
        : "Could not allocate evidence sequence for your library upload.",
    );
  }

  const displayFilename = buildDisplayFilename(input.originalFilename, sequence);
  const seedPack = deriveUploadAliasSeed({
    sourceProgram: effectiveSource?.source_program ?? null,
    sourcePlatform: effectiveSource?.source_platform ?? null,
    originalFilename: input.originalFilename,
  });
  const shortAlias = composeShortAlias(seedPack.base, sequence);
  const suggestedKind =
    input.suggestedEvidenceKind ?? inferSuggestedEvidenceKind(input.mimeType, input.originalFilename);

  const { data, error } = await supabase
    .from("evidence_files")
    .insert({
      ...(input.id ? { id: input.id } : {}),
      case_id: input.caseId ?? null,
      uploaded_by: input.userId,
      storage_path: input.storagePath,
      original_filename: input.originalFilename,
      mime_type: input.mimeType,
      file_size: input.fileSize,
      content_sha256: input.contentSha256 ?? null,
      suggested_evidence_kind: suggestedKind,
      processing_status: input.processingStatus ?? "pending",
      file_sequence_number: sequence,
      display_filename: displayFilename,
      short_alias: shortAlias,
      alias_seed: seedPack.seed,
      alias_seed_type: seedPack.seedType,
      ...(effectiveSource
        ? {
            source_type: effectiveSource.source_type,
            source_platform: effectiveSource.source_platform,
            source_program: effectiveSource.source_program,
            source_url: effectiveSource.source_url,
          }
        : {}),
      ...(input.derivedFromEvidenceId != null && input.derivativeIndex != null
        ? {
            derived_from_evidence_id: input.derivedFromEvidenceId,
            derivative_index: input.derivativeIndex,
            ...(input.derivativeSourcePage != null
              ? { derivative_source_page: input.derivativeSourcePage }
              : {}),
          }
        : {}),
      ...(input.imageCategory ? { image_category: input.imageCategory } : {}),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  const evidenceId = data!.id as string;

  if (input.audit) {
    try {
      await recordEvidenceUploadAudit(supabase, {
        evidenceFileId: evidenceId,
        uploadedBy: input.userId,
        uploaderIp: input.audit.uploaderIp,
        userAgent: input.audit.userAgent,
        uploadMethod: input.audit.uploadMethod ?? null,
      });
    } catch (e) {
      console.warn("[evidence] evidence_upload_audit insert skipped:", e);
    }
  }

  if (input.caseId) {
    try {
      await recordContribution(supabase, {
        caseId: input.caseId,
        userId: input.userId,
        kind: "evidence_upload",
        refId: evidenceId,
        meta: {
          filename: input.originalFilename,
          short_alias: shortAlias,
          display_filename: displayFilename,
        },
      });
    } catch (e) {
      console.warn("[evidence] contribution insert skipped:", e);
    }
  }

  await logActivity(supabase, {
    caseId: input.caseId ?? null,
    actorId: input.userId,
    actorLabel: "Analyst",
    action: "evidence.uploaded",
    entityType: "evidence_file",
    entityId: evidenceId,
    payload: {
      filename: input.originalFilename,
      short_alias: shortAlias,
      display_filename: displayFilename,
      library: input.caseId == null,
    },
  });

  return { id: evidenceId };
}

/**
 * Bulk attach evidence to a case. Failures are per-row; does not stop the batch.
 * - Unassigned (`case_id` null): sets primary case via `assignEvidenceToCase`.
 * - Already on a different case: adds `evidence_case_memberships` via `linkEvidenceToAdditionalCase`.
 * - Already linked to target: no-op success.
 */
export async function bulkAssignEvidenceToCase(
  supabase: AppSupabaseClient,
  input: { evidenceIds: string[]; targetCaseId: string; userId: string },
): Promise<{ results: { evidenceId: string; ok: boolean; error?: string }[] }> {
  const results: { evidenceId: string; ok: boolean; error?: string }[] = [];
  const target = input.targetCaseId;
  for (const evidenceId of input.evidenceIds) {
    try {
      const { data: row, error: fetchErr } = await supabase
        .from("evidence_files")
        .select("case_id")
        .eq("id", evidenceId)
        .maybeSingle();
      if (fetchErr) throw new Error(fetchErr.message);
      if (!row) throw new Error("Evidence not found");

      const cid = row.case_id as string | null;
      if (cid === target) {
        results.push({ evidenceId, ok: true });
        continue;
      }
      if (cid == null) {
        await assignEvidenceToCase(supabase, { evidenceId, caseId: target, userId: input.userId });
      } else {
        try {
          await linkEvidenceToAdditionalCase(supabase, {
            evidenceId,
            targetCaseId: target,
            userId: input.userId,
          });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (msg.includes("already linked")) {
            results.push({ evidenceId, ok: true });
            continue;
          }
          throw e;
        }
      }
      results.push({ evidenceId, ok: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      results.push({ evidenceId, ok: false, error: msg });
    }
  }
  return { results };
}

/** Attach library evidence to a case (membership row + primary case_id). RLS handles case collaboration rights. */
export async function assignEvidenceToCase(
  supabase: AppSupabaseClient,
  input: { evidenceId: string; caseId: string; userId: string },
) {
  const { data: row, error: fetchErr } = await supabase
    .from("evidence_files")
    .select("id, case_id")
    .eq("id", input.evidenceId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!row) throw new Error("Evidence not found");

  const { error: updErr } = await supabase
    .from("evidence_files")
    .update({ case_id: input.caseId })
    .eq("id", input.evidenceId);
  if (updErr) throw new Error(updErr.message);
}

/**
 * Adds `evidence_case_memberships` only (same stored file). Does not change `evidence_files.case_id`.
 * RLS: case collaboration policy (`can_write_case`) governs access. Preserves the original row and storage object.
 */
export async function linkEvidenceToAdditionalCase(
  supabase: AppSupabaseClient,
  input: { evidenceId: string; targetCaseId: string; userId: string },
) {
  const { data: row, error: fetchErr } = await supabase
    .from("evidence_files")
    .select("id")
    .eq("id", input.evidenceId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!row) throw new Error("Evidence not found");

  const { data: existing, error: exErr } = await supabase
    .from("evidence_case_memberships")
    .select("case_id")
    .eq("evidence_file_id", input.evidenceId)
    .eq("case_id", input.targetCaseId)
    .maybeSingle();
  if (exErr && !isEvidenceCaseMembershipTableError(exErr)) throw new Error(exErr.message);
  if (existing) throw new Error("This file is already linked to that investigation.");

  const { error: insErr } = await supabase.from("evidence_case_memberships").insert({
    evidence_file_id: input.evidenceId,
    case_id: input.targetCaseId,
  });
  if (insErr) {
    if (isEvidenceCaseMembershipTableError(insErr)) {
      throw new Error("Case linking is not available on this database (missing membership table).");
    }
    throw new Error(insErr.message);
  }
}

/** Mark multiple evidence rows as viewed; per-row failures do not stop the batch. */
export async function bulkMarkEvidenceViewed(
  supabase: AppSupabaseClient,
  input: { evidenceIds: string[]; userId: string },
): Promise<{ results: { evidenceId: string; ok: boolean; error?: string }[] }> {
  const results: { evidenceId: string; ok: boolean; error?: string }[] = [];
  const now = new Date().toISOString();
  for (const evidenceId of input.evidenceIds) {
    const { error } = await supabase.from("evidence_file_views").upsert(
      {
        user_id: input.userId,
        evidence_file_id: evidenceId,
        viewed_at: now,
      },
      { onConflict: "user_id,evidence_file_id" },
    );
    if (error) {
      results.push({ evidenceId, ok: false, error: error.message });
    } else {
      results.push({ evidenceId, ok: true });
    }
  }
  return { results };
}

/** All evidence files visible to the current user (RLS). */
export async function listEvidenceVisible(supabase: AppSupabaseClient) {
  const { data, error } = await supabase
    .from("evidence_files")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

function isImageEvidenceRow(r: { mime_type?: string | null; suggested_evidence_kind?: string | null }): boolean {
  const mime = (r.mime_type ?? "").toLowerCase();
  const kind = (r.suggested_evidence_kind ?? "").toLowerCase();
  return mime.startsWith("image/") || kind === "image";
}

/**
 * Image Analysis hub: image rows only, optionally filtered by `image_category`.
 */
export async function listEvidenceForImageHub(
  supabase: AppSupabaseClient,
  opts: { imageCategory?: string | null },
) {
  let q = supabase.from("evidence_files").select("*").order("created_at", { ascending: false });
  if (opts.imageCategory) {
    q = q.eq("image_category", opts.imageCategory);
  }
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const rows = (data ?? []).filter(isImageEvidenceRow);
  return rows;
}

/**
 * Location map: evidence in the `location` image category with stored WGS84 coordinates.
 * RLS limits rows to what the caller can read.
 */
export async function listLocationMapPinsForUser(supabase: AppSupabaseClient): Promise<LocationMapPinRow[]> {
  const { data, error } = await supabase
    .from("evidence_files")
    .select("id, display_filename, original_filename, short_alias, case_id, latitude, longitude")
    .eq("image_category", "location")
    .not("latitude", "is", null)
    .not("longitude", "is", null);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const valid = rows.filter((r) => {
    const lat = Number(r.latitude);
    const lon = Number(r.longitude);
    return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  });
  const caseIds = [...new Set(valid.map((r) => r.case_id).filter(Boolean))] as string[];
  const caseTitles = new Map<string, string>();
  if (caseIds.length > 0) {
    const { data: caseRows, error: caseErr } = await supabase.from("cases").select("id, title").in("id", caseIds);
    if (caseErr) throw new Error(caseErr.message);
    for (const c of caseRows ?? []) {
      caseTitles.set(c.id as string, String((c.title as string | null) ?? "").trim() || "Untitled");
    }
  }
  return valid.map((r) => {
    const cid = (r.case_id as string | null) ?? null;
    const title =
      String((r.display_filename as string | null)?.trim() || "") ||
      String((r.original_filename as string | null)?.trim() || "") ||
      "Evidence";
    const href = cid ? `/cases/${cid}/evidence/${r.id as string}` : `/evidence/${r.id as string}`;
    return {
      id: r.id as string,
      href,
      title,
      shortAlias: (r.short_alias as string | null)?.trim() || null,
      caseTitle: cid ? caseTitles.get(cid) ?? null : null,
      caseId: cid,
      latitude: Number(r.latitude),
      longitude: Number(r.longitude),
    };
  });
}

/** Membership counts for marker UI (multi-case). */
export async function getEvidenceCaseMembershipCounts(
  supabase: AppSupabaseClient,
  evidenceIds: string[],
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (evidenceIds.length === 0) return counts;
  const { data, error } = await supabase
    .from("evidence_case_memberships")
    .select("evidence_file_id")
    .in("evidence_file_id", evidenceIds);
  if (error) {
    if (isEvidenceCaseMembershipTableError(error)) return counts;
    throw new Error(error.message);
  }
  for (const r of data ?? []) {
    const id = r.evidence_file_id as string;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return counts;
}

/** Whether each id has at least one AI analysis row. */
export async function getEvidenceHasAiAnalysisMap(
  supabase: AppSupabaseClient,
  evidenceIds: string[],
): Promise<Map<string, boolean>> {
  const set = new Map<string, boolean>();
  for (const id of evidenceIds) set.set(id, false);
  if (evidenceIds.length === 0) return set;
  const { data, error } = await supabase
    .from("ai_analyses")
    .select("evidence_file_id")
    .in("evidence_file_id", evidenceIds);
  if (error) throw new Error(error.message);
  for (const r of data ?? []) {
    set.set(r.evidence_file_id as string, true);
  }
  return set;
}

export async function updateEvidenceStatus(
  supabase: AppSupabaseClient,
  evidenceId: string,
  status: import("@/types").EvidenceProcessingStatus,
  errorMessage?: string | null,
) {
  const { error } = await supabase
    .from("evidence_files")
    .update({
      processing_status: status,
      error_message: errorMessage ?? null,
    })
    .eq("id", evidenceId);
  if (error) throw new Error(error.message);
}

/** Update extraction columns (and optionally processing) without dropping the stored file. */
export async function updateEvidenceExtractionFields(
  supabase: AppSupabaseClient,
  evidenceId: string,
  input: {
    extractionStatus: string;
    extractionUserMessage?: string | null;
    processingStatus?: import("@/types").EvidenceProcessingStatus;
    errorMessage?: string | null;
  },
) {
  const patch: Record<string, unknown> = {
    extraction_status: input.extractionStatus,
    extraction_user_message: input.extractionUserMessage ?? null,
  };
  if (input.processingStatus !== undefined) {
    patch.processing_status = input.processingStatus;
    patch.error_message = input.errorMessage !== undefined ? input.errorMessage : null;
  }
  const { error } = await supabase.from("evidence_files").update(patch).eq("id", evidenceId);
  if (error) throw new Error(error.message);
}

/** Per-user “opened this evidence” flags for library / list bullets (authenticated only). */
export async function getEvidenceViewedSet(
  supabase: AppSupabaseClient,
  userId: string,
  evidenceIds: string[],
): Promise<Set<string>> {
  const out = new Set<string>();
  const ids = [...new Set(evidenceIds)].filter(Boolean);
  if (ids.length === 0) return out;
  const { data, error } = await supabase
    .from("evidence_file_views")
    .select("evidence_file_id")
    .eq("user_id", userId)
    .in("evidence_file_id", ids);
  if (error) {
    console.warn("[evidence] evidence_file_views select failed:", error.message);
    return out;
  }
  for (const r of data ?? []) {
    out.add(r.evidence_file_id as string);
  }
  return out;
}

/**
 * True when another file the same owner can see shares the same content fingerprint (duplicate / overlap signal).
 */
export async function getEvidenceContentDuplicatePeerFlags(
  supabase: AppSupabaseClient,
  scope: { userId: string } | { guestSessionId: string },
  rows: { id: string; content_sha256: string | null }[],
): Promise<Map<string, boolean>> {
  const flags = new Map<string, boolean>();
  for (const r of rows) flags.set(r.id, false);
  const hashes = [...new Set(rows.map((r) => r.content_sha256).filter((h): h is string => Boolean(h)))];
  if (hashes.length === 0) return flags;

  let q = supabase.from("evidence_files").select("id, content_sha256").in("content_sha256", hashes);
  q = "userId" in scope ? q.eq("uploaded_by", scope.userId) : q.eq("guest_session_id", scope.guestSessionId);

  const { data, error } = await q;
  if (error) {
    console.warn("[evidence] duplicate-peer query failed:", error.message);
    return flags;
  }

  const byHash = new Map<string, string[]>();
  for (const r of data ?? []) {
    const h = r.content_sha256 as string | null;
    const id = r.id as string;
    if (!h) continue;
    const arr = byHash.get(h) ?? [];
    arr.push(id);
    byHash.set(h, arr);
  }

  for (const row of rows) {
    const h = row.content_sha256;
    if (!h) continue;
    const peers = byHash.get(h) ?? [];
    if (peers.filter((id) => id !== row.id).length > 0) {
      flags.set(row.id, true);
    }
  }
  return flags;
}

export async function getEvidenceForCase(supabase: AppSupabaseClient, caseId: string) {
  const { data: links, error: lErr } = await supabase
    .from("evidence_case_memberships")
    .select("evidence_file_id")
    .eq("case_id", caseId);
  if (lErr) {
    if (isEvidenceCaseMembershipTableError(lErr)) {
      const { data, error } = await supabase
        .from("evidence_files")
        .select("*")
        .eq("case_id", caseId)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return data ?? [];
    }
    throw new Error(lErr.message);
  }
  const ids = [...new Set((links ?? []).map((r) => r.evidence_file_id as string))];
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from("evidence_files")
    .select("*")
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getEvidenceById(supabase: AppSupabaseClient, evidenceId: string) {
  const { data, error } = await supabase
    .from("evidence_files")
    .select("*")
    .eq("id", evidenceId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function getExtractedText(supabase: AppSupabaseClient, evidenceId: string) {
  const { data, error } = await supabase
    .from("extracted_texts")
    .select("*")
    .eq("evidence_file_id", evidenceId)
    .order("page_number", { ascending: true });
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  if (rows.length === 0) return null;
  if (rows.length === 1) {
    const r = rows[0]!;
    return {
      ...r,
      page_count: 1,
    } as ExtractedText;
  }
  const rawMerged = rows.map((r) => (r.raw_text as string) ?? "").join("\n\n");
  const hasOcr = rows.some((r) => r.extraction_method === "ocr");
  const method: ExtractionMethod = hasOcr ? "ocr" : (rows[0]!.extraction_method as ExtractionMethod);
  const first = rows[0]!;
  return {
    id: first.id as string,
    evidence_file_id: evidenceId,
    raw_text: rawMerged,
    extraction_method: method,
    created_at: first.created_at as string,
    page_count: rows.length,
  } as ExtractedText;
}

export async function getAiAnalysis(supabase: AppSupabaseClient, evidenceId: string) {
  const { data, error } = await supabase
    .from("ai_analyses")
    .select("*")
    .eq("evidence_file_id", evidenceId)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return data?.[0] ?? null;
}
