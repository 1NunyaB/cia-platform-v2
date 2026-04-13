-- Internal audit trail for evidence uploads: IP, user agent, and ingest path.
-- Uploader identity remains on evidence_files.uploaded_by; upload time on evidence_files.created_at.
-- This table is not intended for default UI — RLS allows insert by uploader only; no SELECT for authenticated users.

create table if not exists public.evidence_upload_audit (
  evidence_file_id uuid primary key references public.evidence_files (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  uploader_ip text,
  user_agent text,
  upload_method text,
  created_at timestamptz not null default now(),
  constraint evidence_upload_audit_method_chk check (
    upload_method is null
    or upload_method in ('single_file', 'bulk', 'url_import')
  )
);

comment on table public.evidence_upload_audit is
  'Internal upload audit: client IP, user agent, ingest method. Not shown in default product UI; use service_role or admin tools to inspect.';

comment on column public.evidence_upload_audit.uploader_ip is
  'Best-effort client IP from reverse proxy headers; treat as sensitive audit data.';

create index if not exists idx_evidence_upload_audit_uploaded_by on public.evidence_upload_audit (uploaded_by);

create index if not exists idx_evidence_upload_audit_created_at on public.evidence_upload_audit (created_at desc);

alter table public.evidence_upload_audit enable row level security;

-- Inserts run immediately after evidence_files row creation (same session user = uploader).
drop policy if exists "evidence_upload_audit insert own file" on public.evidence_upload_audit;
create policy "evidence_upload_audit insert own file" on public.evidence_upload_audit for insert
  with check (
    uploaded_by = auth.uid()
    and exists (
      select 1
      from public.evidence_files e
      where e.id = evidence_file_id
        and e.uploaded_by = auth.uid()
    )
  );

-- No SELECT policy for authenticated: default deny (service_role bypasses RLS for operational audit).

grant insert on public.evidence_upload_audit to authenticated;
grant all on public.evidence_upload_audit to service_role;
