-- User-facing evidence kind (Document / Image / Video / Audio): suggested on upload, confirmable separately from stacks/clusters.

alter table public.evidence_files
  add column if not exists suggested_evidence_kind text not null default 'document';

alter table public.evidence_files
  add constraint evidence_files_suggested_evidence_kind_check
  check (suggested_evidence_kind in ('document', 'image', 'video', 'audio'));

alter table public.evidence_files
  add column if not exists confirmed_evidence_kind text;

alter table public.evidence_files
  add constraint evidence_files_confirmed_evidence_kind_check
  check (confirmed_evidence_kind is null or confirmed_evidence_kind in ('document', 'image', 'video', 'audio'));

alter table public.evidence_files
  add column if not exists evidence_kind_confirmed_at timestamptz;

comment on column public.evidence_files.suggested_evidence_kind is
  'Heuristic kind from MIME/filename at upload; not authoritative.';

comment on column public.evidence_files.confirmed_evidence_kind is
  'User-confirmed kind after review; null until confirmed. Library filters use coalesce(confirmed, suggested).';

comment on column public.evidence_files.evidence_kind_confirmed_at is
  'When the user confirmed or last changed the evidence kind.';

create index if not exists idx_evidence_files_effective_kind
  on public.evidence_files ((coalesce(confirmed_evidence_kind, suggested_evidence_kind)));

-- Backfill suggestions from MIME (filename-only cases stay default 'document').
update public.evidence_files
set suggested_evidence_kind = 'image'
where mime_type is not null and lower(mime_type) like 'image/%';

update public.evidence_files
set suggested_evidence_kind = 'video'
where mime_type is not null and lower(mime_type) like 'video/%';

update public.evidence_files
set suggested_evidence_kind = 'audio'
where mime_type is not null and lower(mime_type) like 'audio/%';
