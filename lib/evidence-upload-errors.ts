/** File failed policy checks (type, size, extension). */
export class UploadPolicyError extends Error {
  override readonly name = "UploadPolicyError";
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, UploadPolicyError.prototype);
  }
}

/** Antivirus or security scan flagged the buffer; do not store. */
export class EvidenceScanBlockedError extends Error {
  override readonly name = "EvidenceScanBlockedError";
  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, EvidenceScanBlockedError.prototype);
  }
}

export type DuplicateEvidenceMatch = {
  id: string;
  original_filename: string;
  display_filename: string | null;
  short_alias: string | null;
  case_id: string | null;
  /** Present when returned from `findDuplicateEvidence` / guest duplicate lookup. */
  processing_status?: string | null;
  mime_type?: string | null;
  error_message?: string | null;
};

/** Same bytes (or weak filename+size match) already stored — see `findDuplicateEvidence`. */
export class EvidenceDuplicateError extends Error {
  override readonly name = "EvidenceDuplicateError";
  constructor(
    message: string,
    readonly existing: DuplicateEvidenceMatch,
  ) {
    super(message);
    Object.setPrototypeOf(this, EvidenceDuplicateError.prototype);
  }
}

export function isClientSafeUploadError(e: unknown): e is UploadPolicyError | EvidenceScanBlockedError {
  return e instanceof UploadPolicyError || e instanceof EvidenceScanBlockedError;
}
