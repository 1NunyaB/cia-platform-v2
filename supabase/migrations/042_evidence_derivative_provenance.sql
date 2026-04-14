-- Evidence crop/edit derivatives: provenance back to original chain root, stable numeric suffix.

alter table public.evidence_files
  add column if not exists derived_from_evidence_id uuid references public.evidence_files (id) on delete set null;

alter table public.evidence_files
  add column if not exists derivative_index integer;

comment on column public.evidence_files.derived_from_evidence_id is
  'Root original evidence id for manual crop/edit derivatives; null for primary uploads.';

comment on column public.evidence_files.derivative_index is
  '1-based sequence for derivatives of the same root (__0001, __0002, …); null for originals.';

create index if not exists idx_evidence_files_derived_from
  on public.evidence_files (derived_from_evidence_id)
  where derived_from_evidence_id is not null;
