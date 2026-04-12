import type { AppSupabaseClient, ExtractedText, ExtractionMethod } from "@/types";
import type { EvidenceSourcePayload } from "@/lib/evidence-source";
import type { DuplicateEvidenceMatch } from "@/lib/evidence-upload-errors";
import { buildDisplayFilename, composeShortAlias, deriveUploadAliasSeed } from "@/lib/evidence-display-alias";
import { logActivity } from "@/services/activity-service";
import { recordContribution } from "@/services/contributions-service";

export const EVIDENCE_BUCKET = "evidence";

/**
 * Storage layout: case uploads use `{caseId}/{evidenceId}/{file}`.
 * Library (no case) uses `library/{userId}/{evidenceId}/{file}` so objects stay addressable before assignment.
 */
export function buildStoragePath(
  caseId: string | null,
  userId: string,
  evidenceId: string,
  filename: string,
) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (caseId) {
    return `${caseId}/${evidenceId}/${safe}`;
  }
  return `library/${userId}/${evidenceId}/${safe}`;
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
    .select("id, original_filename, display_filename, short_alias, case_id")
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
    };
  }

  if (input.fileSize != null && input.fileSize >= 0) {
    const { data: legacy, error: lErr } = await supabase
      .from("evidence_files")
      .select("id, original_filename, display_filename, short_alias, case_id")
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
      };
    }
  }

  return null;
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

export async function registerEvidenceFile(
  supabase: AppSupabaseClient,
  input: {
    id?: string;
    /** When null, evidence is stored in the uploader's library (no case). */
    caseId: string | null;
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
  },
) {
  const src = input.source;

  const { data: seqData, error: seqErr } = await supabase.rpc("next_evidence_file_sequence", {
    p_case_id: input.caseId,
  });
  if (seqErr) throw new Error(seqErr.message);
  const sequence = Number(seqData);
  if (!Number.isFinite(sequence) || sequence < 1) {
    throw new Error("Could not allocate evidence sequence for this case.");
  }

  const displayFilename = buildDisplayFilename(input.originalFilename, sequence);
  const seedPack = deriveUploadAliasSeed({
    sourceProgram: src?.source_program ?? null,
    sourcePlatform: src?.source_platform ?? null,
    originalFilename: input.originalFilename,
  });
  const shortAlias = composeShortAlias(seedPack.base, sequence);

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
      processing_status: input.processingStatus ?? "pending",
      file_sequence_number: sequence,
      display_filename: displayFilename,
      short_alias: shortAlias,
      alias_seed: seedPack.seed,
      alias_seed_type: seedPack.seedType,
      ...(src
        ? {
            source_type: src.source_type,
            source_platform: src.source_platform,
            source_program: src.source_program,
            source_url: src.source_url,
          }
        : {}),
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  const evidenceId = data!.id as string;

  if (input.caseId) {
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

/** Attach library evidence to a case (membership row + primary case_id). RLS: uploader + case writer. */
export async function assignEvidenceToCase(
  supabase: AppSupabaseClient,
  input: { evidenceId: string; caseId: string; userId: string },
) {
  const { data: row, error: fetchErr } = await supabase
    .from("evidence_files")
    .select("id, uploaded_by, case_id")
    .eq("id", input.evidenceId)
    .maybeSingle();
  if (fetchErr) throw new Error(fetchErr.message);
  if (!row) throw new Error("Evidence not found");
  if ((row.uploaded_by as string | null) !== input.userId) {
    throw new Error("Only the uploader can assign this file to a case.");
  }

  const { error: updErr } = await supabase
    .from("evidence_files")
    .update({ case_id: input.caseId })
    .eq("id", input.evidenceId);
  if (updErr) throw new Error(updErr.message);
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
  if (error) throw new Error(error.message);
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

export async function getEvidenceForCase(supabase: AppSupabaseClient, caseId: string) {
  const { data: links, error: lErr } = await supabase
    .from("evidence_case_memberships")
    .select("evidence_file_id")
    .eq("case_id", caseId);
  if (lErr) throw new Error(lErr.message);
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
