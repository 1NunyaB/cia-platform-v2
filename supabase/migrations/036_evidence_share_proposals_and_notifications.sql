-- Reciprocal evidence sharing: proposals, in-app notifications, provenance on membership links.
-- Accept flow uses SECURITY DEFINER so target-case writers can link without being the original uploader.

create table if not exists public.evidence_share_proposals (
  id uuid primary key default gen_random_uuid(),
  source_case_id uuid not null references public.cases (id) on delete cascade,
  target_case_id uuid not null references public.cases (id) on delete cascade,
  evidence_file_id uuid not null references public.evidence_files (id) on delete cascade,
  proposed_by uuid not null references public.profiles (id) on delete restrict,
  summary_what text not null,
  summary_why text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  responded_by uuid references public.profiles (id) on delete set null,
  constraint evidence_share_proposals_distinct_cases check (source_case_id <> target_case_id)
);

create unique index if not exists idx_evidence_share_proposals_pending_unique
  on public.evidence_share_proposals (evidence_file_id, target_case_id)
  where status = 'pending';

create index if not exists idx_evidence_share_proposals_target
  on public.evidence_share_proposals (target_case_id, status, created_at desc);

comment on table public.evidence_share_proposals is
  'User-approved proposals to link existing evidence into another investigation (no automatic writes).';

alter table public.evidence_case_memberships
  add column if not exists provenance_source_case_id uuid references public.cases (id) on delete set null;

alter table public.evidence_case_memberships
  add column if not exists share_proposal_id uuid references public.evidence_share_proposals (id) on delete set null;

comment on column public.evidence_case_memberships.provenance_source_case_id is
  'When linked via share approval, records the investigation the file was associated with.';

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_user_notifications_user_unread
  on public.user_notifications (user_id, created_at desc)
  where read_at is null;

alter table public.evidence_share_proposals enable row level security;
alter table public.user_notifications enable row level security;

drop policy if exists "evidence_share_proposals select" on public.evidence_share_proposals;
create policy "evidence_share_proposals select" on public.evidence_share_proposals
  for select using (
    proposed_by = auth.uid()
    or responded_by = auth.uid()
    or public.is_case_member(source_case_id, auth.uid())
    or public.is_case_member(target_case_id, auth.uid())
  );

drop policy if exists "user_notifications select own" on public.user_notifications;
create policy "user_notifications select own" on public.user_notifications
  for select using (user_id = auth.uid());

drop policy if exists "user_notifications update own" on public.user_notifications;
create policy "user_notifications update own" on public.user_notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- create_evidence_share_proposal: validates visibility + notifies target writers
-- ---------------------------------------------------------------------------
create or replace function public.create_evidence_share_proposal(
  p_source_case_id uuid,
  p_target_case_id uuid,
  p_evidence_file_id uuid,
  p_summary_what text,
  p_summary_why text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v_id uuid;
  v_title text;
  v_fn text;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if p_source_case_id = p_target_case_id then
    raise exception 'source and target investigations must differ';
  end if;

  if not public.can_write_case(p_target_case_id, uid) then
    raise exception 'not allowed to propose links into this investigation';
  end if;

  if length(trim(coalesce(p_summary_what, ''))) < 8 or length(trim(coalesce(p_summary_why, ''))) < 8 then
    raise exception 'summary fields must be more descriptive';
  end if;

  if exists (
    select 1 from public.evidence_case_memberships m
    where m.evidence_file_id = p_evidence_file_id and m.case_id = p_target_case_id
  ) then
    raise exception 'evidence is already linked to the target investigation';
  end if;

  if exists (
    select 1 from public.evidence_share_proposals p
    where p.evidence_file_id = p_evidence_file_id
      and p.target_case_id = p_target_case_id
      and p.status = 'pending'
  ) then
    raise exception 'a pending share proposal already exists for this evidence and target';
  end if;

  if not exists (
    select 1 from public.evidence_files e
    where e.id = p_evidence_file_id
      and (
        e.case_id = p_source_case_id
        or exists (
          select 1 from public.evidence_case_memberships m
          where m.evidence_file_id = e.id and m.case_id = p_source_case_id
        )
      )
  ) then
    raise exception 'evidence does not belong to the stated source investigation';
  end if;

  if not exists (
    select 1 from public.evidence_files e
    left join public.cases c on c.id = e.case_id
    where e.id = p_evidence_file_id
      and (
        (
          e.case_id is not null
          and (
            c.visibility = 'public'
            or public.is_case_member(e.case_id, uid)
          )
        )
        or (e.case_id is null and e.uploaded_by = uid)
      )
  ) then
    raise exception 'evidence is not visible for this share proposal';
  end if;

  insert into public.evidence_share_proposals (
    source_case_id,
    target_case_id,
    evidence_file_id,
    proposed_by,
    summary_what,
    summary_why,
    status
  ) values (
    p_source_case_id,
    p_target_case_id,
    p_evidence_file_id,
    uid,
    trim(p_summary_what),
    trim(p_summary_why),
    'pending'
  )
  returning id into v_id;

  select c.title into v_title from public.cases c where c.id = p_source_case_id limit 1;
  select e.original_filename into v_fn from public.evidence_files e where e.id = p_evidence_file_id limit 1;

  insert into public.user_notifications (user_id, kind, title, body, payload)
  select
    w.uid,
    'evidence_share_proposal',
    'Evidence link proposed',
    left(trim(p_summary_what), 400),
    jsonb_build_object(
      'proposal_id', v_id,
      'target_case_id', p_target_case_id,
      'source_case_id', p_source_case_id,
      'evidence_file_id', p_evidence_file_id,
      'proposed_by', uid,
      'source_case_title', coalesce(v_title, ''),
      'evidence_filename', coalesce(v_fn, ''),
      'summary_what', left(trim(p_summary_what), 1200),
      'summary_why', left(trim(p_summary_why), 1200)
    )
  from (
    select distinct x.uid
    from (
      select c.created_by as uid from public.cases c where c.id = p_target_case_id and c.created_by is not null
      union
      select m.user_id as uid from public.case_members m
      where m.case_id = p_target_case_id and m.role in ('owner', 'admin', 'contributor')
    ) x
    where x.uid is not null
  ) w;

  return v_id;
end;
$$;

revoke all on function public.create_evidence_share_proposal(uuid, uuid, uuid, text, text) from public;
grant execute on function public.create_evidence_share_proposal(uuid, uuid, uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- accept / decline (target-case writers; inserts membership on accept)
-- ---------------------------------------------------------------------------
create or replace function public.respond_evidence_share_proposal(
  p_proposal_id uuid,
  p_accept boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  v public.evidence_share_proposals%rowtype;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  select * into v
  from public.evidence_share_proposals
  where id = p_proposal_id
  for update;

  if not found then
    raise exception 'proposal not found';
  end if;

  if v.status <> 'pending' then
    raise exception 'proposal is no longer pending';
  end if;

  if not public.can_write_case(v.target_case_id, uid) then
    raise exception 'not allowed to respond for this investigation';
  end if;

  if p_accept then
    if not exists (
      select 1 from public.evidence_case_memberships m
      where m.evidence_file_id = v.evidence_file_id and m.case_id = v.target_case_id
    ) then
      insert into public.evidence_case_memberships (
        evidence_file_id,
        case_id,
        provenance_source_case_id,
        share_proposal_id
      ) values (
        v.evidence_file_id,
        v.target_case_id,
        v.source_case_id,
        v.id
      );
    end if;

    update public.evidence_share_proposals
    set status = 'accepted',
        responded_at = now(),
        responded_by = uid
    where id = p_proposal_id;
  else
    update public.evidence_share_proposals
    set status = 'declined',
        responded_at = now(),
        responded_by = uid
    where id = p_proposal_id;
  end if;
end;
$$;

revoke all on function public.respond_evidence_share_proposal(uuid, boolean) from public;
grant execute on function public.respond_evidence_share_proposal(uuid, boolean) to authenticated;

comment on function public.create_evidence_share_proposal(uuid, uuid, uuid, text, text) is
  'Creates a pending share proposal and notifies all target-case writers (owner/admin/contributor + creator).';

comment on function public.respond_evidence_share_proposal(uuid, boolean) is
  'Accept links evidence into target case with provenance; decline closes proposal without linking.';
