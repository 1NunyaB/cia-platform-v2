-- Evidence can exist without a case (personal library). Optional case assignment via evidence_files.case_id
-- plus evidence_case_memberships for future multi-case links and marker counts.

-- ---------------------------------------------------------------------------
-- User-scoped sequence for uploads with no case (display + alias uniqueness per uploader)
-- ---------------------------------------------------------------------------
create table if not exists public.user_evidence_counters (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  last_seq integer not null default 0
);

alter table public.user_evidence_counters enable row level security;

drop policy if exists "user_evidence_counters select own" on public.user_evidence_counters;
create policy "user_evidence_counters select own" on public.user_evidence_counters
  for select using (user_id = auth.uid());

drop policy if exists "user_evidence_counters write own" on public.user_evidence_counters;
create policy "user_evidence_counters write own" on public.user_evidence_counters
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Many-to-many: evidence ↔ case (backfilled from evidence_files.case_id)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Nullable case_id on evidence_files
-- ---------------------------------------------------------------------------
alter table public.evidence_files drop constraint if exists evidence_files_case_id_fkey;

alter table public.evidence_files alter column case_id drop not null;

alter table public.evidence_files
  add constraint evidence_files_case_id_fkey
  foreign key (case_id) references public.cases (id) on delete cascade;

-- Replace global unique indexes with partial (per-case vs per-user library)
drop index if exists idx_evidence_files_case_sequence;
drop index if exists idx_evidence_files_case_short_alias;

create unique index if not exists idx_evidence_files_case_sequence_nn
  on public.evidence_files (case_id, file_sequence_number)
  where case_id is not null;

create unique index if not exists idx_evidence_files_user_lib_sequence
  on public.evidence_files (uploaded_by, file_sequence_number)
  where case_id is null;

create unique index if not exists idx_evidence_files_case_alias_nn
  on public.evidence_files (case_id, short_alias)
  where case_id is not null;

create unique index if not exists idx_evidence_files_user_lib_alias
  on public.evidence_files (uploaded_by, short_alias)
  where case_id is null;

-- ---------------------------------------------------------------------------
-- Backfill memberships from existing rows (before triggers)
-- ---------------------------------------------------------------------------
insert into public.evidence_case_memberships (evidence_file_id, case_id)
select id, case_id
from public.evidence_files
where case_id is not null
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- next_evidence_file_sequence: NULL case_id → user library counter
-- ---------------------------------------------------------------------------
create or replace function public.next_evidence_file_sequence(p_case_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v integer;
  uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if p_case_id is null then
    insert into public.user_evidence_counters (user_id, last_seq)
    values (uid, 1)
    on conflict (user_id) do update
    set last_seq = public.user_evidence_counters.last_seq + 1
    returning last_seq into v;
    return v;
  end if;

  if not public.can_write_case(p_case_id, uid) then
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

-- ---------------------------------------------------------------------------
-- Sync membership row when evidence is linked to a case
-- ---------------------------------------------------------------------------
create or replace function public.sync_evidence_case_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.case_id is not null then
    insert into public.evidence_case_memberships (evidence_file_id, case_id)
    values (new.id, new.case_id)
    on conflict (evidence_file_id, case_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_evidence_sync_membership_ins on public.evidence_files;
create trigger trg_evidence_sync_membership_ins
  after insert on public.evidence_files
  for each row execute function public.sync_evidence_case_membership();

create or replace function public.sync_evidence_case_membership_upd()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.case_id is not null and (old.case_id is distinct from new.case_id) then
    insert into public.evidence_case_memberships (evidence_file_id, case_id)
    values (new.id, new.case_id)
    on conflict (evidence_file_id, case_id) do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_evidence_sync_membership_upd on public.evidence_files;
create trigger trg_evidence_sync_membership_upd
  after update of case_id on public.evidence_files
  for each row execute function public.sync_evidence_case_membership_upd();

-- ---------------------------------------------------------------------------
-- Activity log: optional case for library events
-- ---------------------------------------------------------------------------
alter table public.activity_log drop constraint if exists activity_log_case_id_fkey;
alter table public.activity_log alter column case_id drop not null;
alter table public.activity_log
  add constraint activity_log_case_id_fkey
  foreign key (case_id) references public.cases (id) on delete cascade;

drop policy if exists "Activity select" on public.activity_log;
create policy "Activity select" on public.activity_log for select using (
  (
    case_id is not null
    and (
      public.is_case_member(case_id, auth.uid())
      or exists (select 1 from public.cases c where c.id = case_id and c.visibility = 'public')
    )
  )
  or (
    case_id is null
    and actor_id = auth.uid()
  )
);

drop policy if exists "Activity insert" on public.activity_log;
create policy "Activity insert" on public.activity_log for insert with check (
  (actor_id is null or actor_id = auth.uid())
  and (
    (
      case_id is not null
      and (
        public.is_case_member(case_id, auth.uid())
        or exists (select 1 from public.cases c where c.id = case_id and c.visibility = 'public')
      )
    )
    or (case_id is null and actor_id = auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- Evidence files RLS: library rows visible to uploader
-- ---------------------------------------------------------------------------
drop policy if exists "Evidence select" on public.evidence_files;
create policy "Evidence select" on public.evidence_files for select using (
  (
    case_id is not null
    and exists (
      select 1 from public.cases c
      where c.id = evidence_files.case_id
        and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
    )
  )
  or (
    case_id is null
    and uploaded_by = auth.uid()
  )
  or exists (
    select 1 from public.evidence_case_memberships m
    join public.cases c on c.id = m.case_id
    where m.evidence_file_id = evidence_files.id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

drop policy if exists "Evidence insert" on public.evidence_files;
create policy "Evidence insert" on public.evidence_files for insert with check (
  (
    case_id is not null
    and public.can_write_case(case_id, auth.uid())
  )
  or (
    case_id is null
    and uploaded_by = auth.uid()
  )
);

drop policy if exists "Evidence update" on public.evidence_files;
create policy "Evidence update" on public.evidence_files for update using (
  (
    case_id is not null
    and public.can_write_case(case_id, auth.uid())
  )
  or (
    case_id is null
    and uploaded_by = auth.uid()
  )
) with check (
  (
    case_id is not null
    and public.can_write_case(case_id, auth.uid())
  )
  or (
    case_id is null
    and uploaded_by = auth.uid()
  )
);

-- ---------------------------------------------------------------------------
-- Extracted texts + AI analyses: allow library evidence owned by user
-- ---------------------------------------------------------------------------
drop policy if exists "Extracted select" on public.extracted_texts;
create policy "Extracted select" on public.extracted_texts for select using (
  exists (
    select 1 from public.evidence_files e
    left join public.cases c on c.id = e.case_id
    where e.id = extracted_texts.evidence_file_id
      and (
        (e.case_id is not null and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid())))
        or (e.case_id is null and e.uploaded_by = auth.uid())
        or exists (
          select 1 from public.evidence_case_memberships m
          join public.cases c2 on c2.id = m.case_id
          where m.evidence_file_id = e.id
            and (c2.visibility = 'public' or public.is_case_member(c2.id, auth.uid()))
        )
      )
  )
);

drop policy if exists "Extracted all for writers" on public.extracted_texts;
create policy "Extracted all for writers" on public.extracted_texts for all using (
  exists (
    select 1 from public.evidence_files e
    where e.id = extracted_texts.evidence_file_id
      and (
        (e.case_id is not null and public.can_write_case(e.case_id, auth.uid()))
        or (e.case_id is null and e.uploaded_by = auth.uid())
      )
  )
) with check (
  exists (
    select 1 from public.evidence_files e
    where e.id = extracted_texts.evidence_file_id
      and (
        (e.case_id is not null and public.can_write_case(e.case_id, auth.uid()))
        or (e.case_id is null and e.uploaded_by = auth.uid())
      )
  )
);

drop policy if exists "AI select" on public.ai_analyses;
create policy "AI select" on public.ai_analyses for select using (
  exists (
    select 1 from public.evidence_files e
    left join public.cases c on c.id = e.case_id
    where e.id = ai_analyses.evidence_file_id
      and (
        (e.case_id is not null and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid())))
        or (e.case_id is null and e.uploaded_by = auth.uid())
        or exists (
          select 1 from public.evidence_case_memberships m
          join public.cases c2 on c2.id = m.case_id
          where m.evidence_file_id = e.id
            and (c2.visibility = 'public' or public.is_case_member(c2.id, auth.uid()))
        )
      )
  )
);

drop policy if exists "AI write" on public.ai_analyses;
create policy "AI write" on public.ai_analyses for all using (
  exists (
    select 1 from public.evidence_files e
    where e.id = ai_analyses.evidence_file_id
      and (
        (e.case_id is not null and public.can_write_case(e.case_id, auth.uid()))
        or (e.case_id is null and e.uploaded_by = auth.uid())
      )
  )
) with check (
  exists (
    select 1 from public.evidence_files e
    where e.id = ai_analyses.evidence_file_id
      and (
        (e.case_id is not null and public.can_write_case(e.case_id, auth.uid()))
        or (e.case_id is null and e.uploaded_by = auth.uid())
      )
  )
);

comment on column public.evidence_files.case_id is
  'When null, evidence lives in the uploader library until assigned to a case. Memberships table also links files to cases.';
