-- Optional guest access: session table, usage logging, guest-scoped evidence (library-only).

-- ---------------------------------------------------------------------------
-- Guest sessions (browser cookie holds id; server validates)
-- ---------------------------------------------------------------------------
create table if not exists public.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  ip_address text,
  user_agent text,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  linked_user_id uuid references auth.users (id) on delete set null
);

comment on table public.guest_sessions is
  'Anonymous browser sessions. Link to linked_user_id after sign-up for optional data migration.';

create index if not exists idx_guest_sessions_linked on public.guest_sessions (linked_user_id)
  where linked_user_id is not null;

create index if not exists idx_guest_sessions_last_seen on public.guest_sessions (last_seen_at desc);

alter table public.guest_sessions enable row level security;

-- No policies: only service_role / backend inserts and reads.

grant select, insert, update on public.guest_sessions to service_role;

-- ---------------------------------------------------------------------------
-- Per-guest sequence for library evidence (parallel to user_evidence_counters)
-- ---------------------------------------------------------------------------
create table if not exists public.guest_evidence_counters (
  guest_session_id uuid primary key references public.guest_sessions (id) on delete cascade,
  last_seq integer not null default 0
);

alter table public.guest_evidence_counters enable row level security;

grant all on public.guest_evidence_counters to service_role;

-- ---------------------------------------------------------------------------
-- Usage / activity log (authenticated user OR guest session, never both)
-- ---------------------------------------------------------------------------
create table if not exists public.usage_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  guest_session_id uuid references public.guest_sessions (id) on delete set null,
  action text not null,
  meta jsonb not null default '{}'::jsonb,
  constraint usage_events_actor_chk check (
    (user_id is not null and guest_session_id is null)
    or (user_id is null and guest_session_id is not null)
  )
);

comment on table public.usage_events is
  'Server-side usage logging; ties events to auth user id or guest_session_id.';

create index if not exists idx_usage_events_user on public.usage_events (user_id, occurred_at desc);
create index if not exists idx_usage_events_guest on public.usage_events (guest_session_id, occurred_at desc);
create index if not exists idx_usage_events_action on public.usage_events (action, occurred_at desc);

alter table public.usage_events enable row level security;

grant all on public.usage_events to service_role;

-- ---------------------------------------------------------------------------
-- evidence_files: guest-owned library rows (uploaded_by null, guest_session_id set)
-- ---------------------------------------------------------------------------
alter table public.evidence_files
  add column if not exists guest_session_id uuid references public.guest_sessions (id) on delete cascade;

do $$
begin
  if exists (
    select 1 from public.evidence_files
    where uploaded_by is null and guest_session_id is null
  ) then
    raise exception 'Cannot add uploader/guest constraint: evidence_files has rows with both uploaded_by and guest_session_id null';
  end if;
end $$;

alter table public.evidence_files drop constraint if exists evidence_files_uploader_or_guest_chk;
alter table public.evidence_files add constraint evidence_files_uploader_or_guest_chk check (
  (guest_session_id is null and uploaded_by is not null)
  or (guest_session_id is not null and uploaded_by is null)
);

create unique index if not exists idx_evidence_files_guest_lib_sequence
  on public.evidence_files (guest_session_id, file_sequence_number)
  where case_id is null and guest_session_id is not null;

create unique index if not exists idx_evidence_files_guest_lib_alias
  on public.evidence_files (guest_session_id, short_alias)
  where case_id is null and guest_session_id is not null and short_alias is not null;

-- ---------------------------------------------------------------------------
-- Guest library sequence RPC (service / backend only)
-- ---------------------------------------------------------------------------
create or replace function public.next_guest_evidence_file_sequence(p_guest_session_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v integer;
begin
  if p_guest_session_id is null then
    raise exception 'guest_session_id required';
  end if;
  if not exists (select 1 from public.guest_sessions g where g.id = p_guest_session_id) then
    raise exception 'unknown guest session';
  end if;

  insert into public.guest_evidence_counters (guest_session_id, last_seq)
  values (p_guest_session_id, 1)
  on conflict (guest_session_id) do update
  set last_seq = public.guest_evidence_counters.last_seq + 1
  returning last_seq into v;

  return v;
end;
$$;

grant execute on function public.next_guest_evidence_file_sequence(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- evidence_upload_audit: support guest uploads (one of uploaded_by or guest_session_id)
-- ---------------------------------------------------------------------------
drop policy if exists "evidence_upload_audit insert own file" on public.evidence_upload_audit;

alter table public.evidence_upload_audit drop constraint if exists evidence_upload_audit_uploaded_by_fkey;
alter table public.evidence_upload_audit alter column uploaded_by drop not null;

alter table public.evidence_upload_audit
  add column if not exists guest_session_id uuid references public.guest_sessions (id) on delete cascade;

alter table public.evidence_upload_audit
  add constraint evidence_upload_audit_uploaded_by_fkey
  foreign key (uploaded_by) references public.profiles (id) on delete restrict;

alter table public.evidence_upload_audit drop constraint if exists evidence_upload_audit_actor_chk;
alter table public.evidence_upload_audit add constraint evidence_upload_audit_actor_chk check (
  (uploaded_by is not null and guest_session_id is null)
  or (uploaded_by is null and guest_session_id is not null)
);

create policy "evidence_upload_audit insert own file" on public.evidence_upload_audit for insert
  with check (
    uploaded_by = auth.uid()
    and guest_session_id is null
    and exists (
      select 1
      from public.evidence_files e
      where e.id = evidence_file_id
        and e.uploaded_by = auth.uid()
    )
  );

comment on column public.evidence_upload_audit.guest_session_id is
  'Set for guest uploads; rows inserted via service_role bypass RLS.';

create index if not exists idx_evidence_upload_audit_guest on public.evidence_upload_audit (guest_session_id)
  where guest_session_id is not null;
