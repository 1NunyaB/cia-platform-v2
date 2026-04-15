-- PDF page-split derivatives: which page of the root PDF produced this row (provenance).

alter table public.evidence_files
  add column if not exists derivative_source_page integer;

comment on column public.evidence_files.derivative_source_page is
  '1-based PDF page index when this row is a single-page extract from a multi-page PDF; null otherwise.';

create index if not exists idx_evidence_files_derived_source_page
  on public.evidence_files (derived_from_evidence_id, derivative_source_page)
  where derivative_source_page is not null;
