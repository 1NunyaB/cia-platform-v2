-- Stable per-case sequence, display filename (stem__NNN), and human-readable short_alias.

create table if not exists public.case_evidence_counters (
  case_id uuid primary key references public.cases (id) on delete cascade,
  last_seq integer not null default 0
);

alter table public.case_evidence_counters enable row level security;

create policy "case_evidence_counters select" on public.case_evidence_counters for select using (
  exists (
    select 1 from public.cases c
    where c.id = case_evidence_counters.case_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "case_evidence_counters write" on public.case_evidence_counters for all using (
  public.can_write_case(case_id, auth.uid())
) with check (public.can_write_case(case_id, auth.uid()));

create or replace function public.next_evidence_file_sequence(p_case_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v integer;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if not public.can_write_case(p_case_id, auth.uid()) then
    raise exception 'forbidden';
  end if;

  insert into public.case_evidence_counters (case_id, last_seq)
  values (p_case_id, 1)
  on conflict (case_id) do update
  set last_seq = public.case_evidence_counters.last_seq + 1
  returning last_seq into v;

  return v;
end;
$$;

grant execute on function public.next_evidence_file_sequence(uuid) to authenticated;
grant execute on function public.next_evidence_file_sequence(uuid) to service_role;

alter table public.evidence_files
  add column if not exists file_sequence_number integer;

alter table public.evidence_files
  add column if not exists display_filename text;

alter table public.evidence_files
  add column if not exists short_alias text;

alter table public.evidence_files
  add column if not exists alias_seed text;

alter table public.evidence_files
  add column if not exists alias_seed_type text
    check (
      alias_seed_type is null
      or alias_seed_type in (
        'cluster',
        'entity',
        'location',
        'source_program',
        'source_platform',
        'original_basename',
        'generic'
      )
    );

comment on column public.evidence_files.display_filename is
  'Stable display label: original stem + __ + zero-padded case sequence (original_filename unchanged).';
comment on column public.evidence_files.short_alias is
  'Stable human-readable case-unique reference (e.g. Clinton67). Not auto-renamed when graph changes.';
comment on column public.evidence_files.alias_seed is
  'Label snapshot used when the short alias was created.';
comment on column public.evidence_files.alias_seed_type is
  'Which signal was strongest when the alias was minted.';

-- Backfill legacy rows (single pass per case by created_at)
with numbered as (
  select
    id,
    case_id,
    row_number() over (partition by case_id order by created_at asc, id asc) as n
  from public.evidence_files
  where file_sequence_number is null
)
update public.evidence_files e
set
  file_sequence_number = numbered.n,
  display_filename = regexp_replace(e.original_filename, '\.[^.]+$', '', 'gi')
    || '__' || lpad(numbered.n::text, 3, '0'),
  short_alias = 'Evidence' || numbered.n::text,
  alias_seed = coalesce(
    nullif(trim(e.source_program), ''),
    nullif(trim(e.source_platform), ''),
    regexp_replace(e.original_filename, '\.[^.]+$', '', 'gi')
  ),
  alias_seed_type = case
    when coalesce(nullif(trim(e.source_program), ''), '') <> '' then 'source_program'::text
    when coalesce(nullif(trim(e.source_platform), ''), '') <> '' then 'source_platform'::text
    else 'original_basename'::text
  end
from numbered
where e.id = numbered.id;

-- Neutral fallback label where backfill left gaps
update public.evidence_files
set short_alias = 'Evidence' || file_sequence_number::text
where short_alias is null and file_sequence_number is not null;

update public.evidence_files
set display_filename = regexp_replace(original_filename, '\.[^.]+$', '', 'gi')
  || '__' || lpad(file_sequence_number::text, 3, '0')
where display_filename is null and file_sequence_number is not null;

-- Sync counters to max seq per case
insert into public.case_evidence_counters (case_id, last_seq)
select case_id, coalesce(max(file_sequence_number), 0)
from public.evidence_files
group by case_id
on conflict (case_id) do update
set last_seq = greatest(public.case_evidence_counters.last_seq, excluded.last_seq);

create unique index if not exists idx_evidence_files_case_sequence
  on public.evidence_files (case_id, file_sequence_number);

create unique index if not exists idx_evidence_files_case_short_alias
  on public.evidence_files (case_id, short_alias);

alter table public.evidence_files alter column file_sequence_number set not null;
alter table public.evidence_files alter column display_filename set not null;
alter table public.evidence_files alter column short_alias set not null;
