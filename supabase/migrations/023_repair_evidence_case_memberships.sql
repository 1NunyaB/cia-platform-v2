-- Idempotent repair: some deployments never applied 019; PostgREST then errors with
-- "Could not find the table 'public.evidence_case_memberships' in the schema cache".
-- This block matches 019's junction table + RLS (safe to re-run).

create table if not exists public.evidence_case_memberships (
  evidence_file_id uuid not null references public.evidence_files (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (evidence_file_id, case_id)
);

create index if not exists idx_evidence_case_memberships_case on public.evidence_case_memberships (case_id);

alter table public.evidence_case_memberships enable row level security;

drop policy if exists "evidence_case_memberships select" on public.evidence_case_memberships;
create policy "evidence_case_memberships select" on public.evidence_case_memberships for select using (
  public.is_case_member(case_id, auth.uid())
  or exists (
    select 1 from public.evidence_files e
    where e.id = evidence_case_memberships.evidence_file_id
      and e.uploaded_by = auth.uid()
  )
);

drop policy if exists "evidence_case_memberships insert" on public.evidence_case_memberships;
create policy "evidence_case_memberships insert" on public.evidence_case_memberships for insert with check (
  public.can_write_case(case_id, auth.uid())
  and exists (
    select 1 from public.evidence_files e
    where e.id = evidence_file_id
      and e.uploaded_by = auth.uid()
  )
);

drop policy if exists "evidence_case_memberships delete" on public.evidence_case_memberships;
create policy "evidence_case_memberships delete" on public.evidence_case_memberships for delete using (
  public.can_write_case(case_id, auth.uid())
  and exists (
    select 1 from public.evidence_files e
    where e.id = evidence_file_id
      and e.uploaded_by = auth.uid()
  )
);

-- Backfill from evidence_files.case_id when column exists and is set (no-op if already synced).
insert into public.evidence_case_memberships (evidence_file_id, case_id)
select id, case_id
from public.evidence_files
where case_id is not null
on conflict do nothing;
