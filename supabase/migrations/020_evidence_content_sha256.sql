-- Fingerprint for duplicate detection (same bytes = same SHA-256). Not a uniqueness constraint:
-- analysts may intentionally re-upload; we block only after explicit duplicate response unless force_upload is used.

alter table public.evidence_files
  add column if not exists content_sha256 text;

comment on column public.evidence_files.content_sha256 is
  'SHA-256 hex digest of uploaded file bytes at ingest time; used for duplicate detection.';

create index if not exists idx_evidence_files_content_sha256
  on public.evidence_files (content_sha256)
  where content_sha256 is not null;
