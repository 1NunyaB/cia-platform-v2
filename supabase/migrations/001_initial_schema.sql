-- CIS — Collaborative Investigation Sleuths — initial schema
-- Run in Supabase SQL editor or via supabase db push
-- Create storage bucket "evidence" (private) in Dashboard; path pattern: {case_id}/{evidence_id}/{filename}

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
do $$ begin
  create type case_visibility as enum ('private', 'team', 'public');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type case_member_role as enum ('owner', 'admin', 'contributor', 'viewer');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type evidence_processing_status as enum ('pending', 'extracting', 'analyzing', 'complete', 'error');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type extraction_method as enum ('plain_text', 'pdf_text', 'ocr_pending');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type contribution_kind as enum ('note', 'comment', 'evidence_upload', 'analysis_run', 'invite');
exception when duplicate_object then null;
end $$;

-- Profiles (1:1 with auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  visibility case_visibility not null default 'private',
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.case_members (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role case_member_role not null,
  invited_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  unique (case_id, user_id)
);

create table if not exists public.case_invites (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  email text not null,
  role case_member_role not null default 'contributor',
  token text not null unique,
  invited_by uuid not null references public.profiles (id),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (case_id, email)
);

create table if not exists public.evidence_files (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  uploaded_by uuid not null references public.profiles (id),
  storage_path text not null,
  original_filename text not null,
  mime_type text,
  file_size bigint,
  processing_status evidence_processing_status not null default 'pending',
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.extracted_texts (
  id uuid primary key default gen_random_uuid(),
  evidence_file_id uuid not null references public.evidence_files (id) on delete cascade,
  raw_text text,
  extraction_method extraction_method not null,
  created_at timestamptz not null default now(),
  unique (evidence_file_id)
);

create table if not exists public.ai_analyses (
  id uuid primary key default gen_random_uuid(),
  evidence_file_id uuid not null references public.evidence_files (id) on delete cascade,
  summary text,
  redaction_notes text,
  model text,
  structured jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_analyses_evidence on public.ai_analyses (evidence_file_id);

create table if not exists public.entities (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  evidence_file_id uuid references public.evidence_files (id) on delete set null,
  ai_analysis_id uuid references public.ai_analyses (id) on delete cascade,
  label text not null,
  entity_type text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_entities_case on public.entities (case_id);

create table if not exists public.entity_mentions (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references public.entities (id) on delete cascade,
  evidence_file_id uuid not null references public.evidence_files (id) on delete cascade,
  snippet text,
  start_offset int,
  end_offset int,
  created_at timestamptz not null default now()
);

create table if not exists public.relationships (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  evidence_file_id uuid references public.evidence_files (id) on delete set null,
  ai_analysis_id uuid references public.ai_analyses (id) on delete cascade,
  source_entity_id uuid references public.entities (id) on delete set null,
  target_entity_id uuid references public.entities (id) on delete set null,
  relation_type text,
  description text,
  created_at timestamptz not null default now()
);

create index if not exists idx_relationships_case on public.relationships (case_id);

create table if not exists public.timeline_events (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  evidence_file_id uuid references public.evidence_files (id) on delete set null,
  ai_analysis_id uuid references public.ai_analyses (id) on delete cascade,
  occurred_at timestamptz,
  title text not null,
  summary text,
  created_at timestamptz not null default now()
);

create index if not exists idx_timeline_case_time on public.timeline_events (case_id, occurred_at);

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  evidence_file_id uuid references public.evidence_files (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  evidence_file_id uuid references public.evidence_files (id) on delete cascade,
  note_id uuid references public.notes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.contributions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind contribution_kind not null,
  ref_id uuid,
  meta jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_contributions_case on public.contributions (case_id, created_at desc);

-- Activity log (denormalized for feed)
create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_case on public.activity_log (case_id, created_at desc);

-- Triggers: new user → profile
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cases_updated_at on public.cases;
create trigger cases_updated_at before update on public.cases
  for each row execute function public.set_updated_at();

drop trigger if exists notes_updated_at on public.notes;
create trigger notes_updated_at before update on public.notes
  for each row execute function public.set_updated_at();

drop trigger if exists ai_analyses_updated_at on public.ai_analyses;
create trigger ai_analyses_updated_at before update on public.ai_analyses
  for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.cases enable row level security;
alter table public.case_members enable row level security;
alter table public.case_invites enable row level security;
alter table public.evidence_files enable row level security;
alter table public.extracted_texts enable row level security;
alter table public.ai_analyses enable row level security;
alter table public.entities enable row level security;
alter table public.entity_mentions enable row level security;
alter table public.relationships enable row level security;
alter table public.timeline_events enable row level security;
alter table public.notes enable row level security;
alter table public.comments enable row level security;
alter table public.contributions enable row level security;
alter table public.activity_log enable row level security;

-- Helper: is member of case
create or replace function public.is_case_member(p_case uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.case_members m
    where m.case_id = p_case and m.user_id = p_user
  );
$$;

create or replace function public.can_write_case(p_case uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.case_members m
    where m.case_id = p_case and m.user_id = p_user
      and m.role in ('owner', 'admin', 'contributor')
  );
$$;

-- Profiles (read all authenticated for collaborator display names)
create policy "Profiles select authenticated" on public.profiles for select to authenticated using (true);
create policy "Users update own profile" on public.profiles for update using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles for insert with check (auth.uid() = id);

-- Cases: visible if public, or member, or created_by (before member row exists — creator should add self as owner via app)
create policy "Cases select" on public.cases for select using (
  visibility = 'public'
  or created_by = auth.uid()
  or public.is_case_member(id, auth.uid())
);

create policy "Cases insert" on public.cases for insert with check (auth.uid() = created_by);

create policy "Cases update" on public.cases for update using (
  exists (
    select 1 from public.case_members m
    where m.case_id = cases.id and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  )
);

create policy "Cases delete" on public.cases for delete using (
  exists (
    select 1 from public.case_members m
    where m.case_id = cases.id and m.user_id = auth.uid() and m.role = 'owner'
  )
);

-- Case members
create policy "Members select" on public.case_members for select using (
  public.is_case_member(case_id, auth.uid())
  or exists (select 1 from public.cases c where c.id = case_id and c.visibility = 'public')
);

create policy "Members insert" on public.case_members for insert with check (
  public.can_write_case(case_id, auth.uid())
  or exists (select 1 from public.cases c where c.id = case_id and c.created_by = auth.uid())
);

create policy "Members update" on public.case_members for update using (
  exists (
    select 1 from public.case_members m
    where m.case_id = case_members.case_id and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  )
);

create policy "Members delete" on public.case_members for delete using (
  exists (
    select 1 from public.case_members m
    where m.case_id = case_members.case_id and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  )
);

-- Invites
create policy "Invites select" on public.case_invites for select using (
  public.can_write_case(case_id, auth.uid())
);

create policy "Invites insert" on public.case_invites for insert with check (
  public.can_write_case(case_id, auth.uid())
);

-- Evidence & children: member or public read for public cases
create policy "Evidence select" on public.evidence_files for select using (
  exists (
    select 1 from public.cases c
    where c.id = evidence_files.case_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "Evidence insert" on public.evidence_files for insert with check (
  public.can_write_case(case_id, auth.uid())
);

create policy "Evidence update" on public.evidence_files for update using (
  public.can_write_case(case_id, auth.uid())
);

create policy "Extracted select" on public.extracted_texts for select using (
  exists (
    select 1 from public.evidence_files e
    join public.cases c on c.id = e.case_id
    where e.id = extracted_texts.evidence_file_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "Extracted all for writers" on public.extracted_texts for all using (
  exists (
    select 1 from public.evidence_files e
    where e.id = extracted_texts.evidence_file_id
      and public.can_write_case(e.case_id, auth.uid())
  )
) with check (
  exists (
    select 1 from public.evidence_files e
    where e.id = extracted_texts.evidence_file_id
      and public.can_write_case(e.case_id, auth.uid())
  )
);

create policy "AI select" on public.ai_analyses for select using (
  exists (
    select 1 from public.evidence_files e
    join public.cases c on c.id = e.case_id
    where e.id = ai_analyses.evidence_file_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "AI write" on public.ai_analyses for all using (
  exists (
    select 1 from public.evidence_files e
    where e.id = ai_analyses.evidence_file_id
      and public.can_write_case(e.case_id, auth.uid())
  )
) with check (
  exists (
    select 1 from public.evidence_files e
    where e.id = ai_analyses.evidence_file_id
      and public.can_write_case(e.case_id, auth.uid())
  )
);

-- Entities / graph (case scoped)
create policy "Entities select" on public.entities for select using (
  exists (
    select 1 from public.cases c
    where c.id = entities.case_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "Entities write" on public.entities for all using (
  public.can_write_case(case_id, auth.uid())
) with check (public.can_write_case(case_id, auth.uid()));

create policy "Mentions select" on public.entity_mentions for select using (
  exists (
    select 1 from public.entities en
    join public.cases c on c.id = en.case_id
    where en.id = entity_mentions.entity_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "Mentions write" on public.entity_mentions for all using (
  exists (
    select 1 from public.entities en
    where en.id = entity_mentions.entity_id
      and public.can_write_case(en.case_id, auth.uid())
  )
) with check (
  exists (
    select 1 from public.entities en
    where en.id = entity_mentions.entity_id
      and public.can_write_case(en.case_id, auth.uid())
  )
);

create policy "Relationships select" on public.relationships for select using (
  exists (
    select 1 from public.cases c
    where c.id = relationships.case_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "Relationships write" on public.relationships for all using (
  public.can_write_case(case_id, auth.uid())
) with check (public.can_write_case(case_id, auth.uid()));

create policy "Timeline select" on public.timeline_events for select using (
  exists (
    select 1 from public.cases c
    where c.id = timeline_events.case_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "Timeline write" on public.timeline_events for all using (
  public.can_write_case(case_id, auth.uid())
) with check (public.can_write_case(case_id, auth.uid()));

-- Notes & comments: public case viewers can read; writers can add notes on team/private; public viewers add notes/comments per requirement
create policy "Notes select" on public.notes for select using (
  exists (
    select 1 from public.cases c
    where c.id = notes.case_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "Notes insert" on public.notes for insert with check (
  user_id = auth.uid()
  and (
    exists (
      select 1 from public.cases c
      where c.id = notes.case_id
        and (
          c.visibility = 'public'
          or public.can_write_case(c.id, auth.uid())
          or (c.visibility = 'team' and public.is_case_member(c.id, auth.uid()))
        )
    )
  )
);

create policy "Notes update" on public.notes for update using (user_id = auth.uid());

create policy "Comments select" on public.comments for select using (
  exists (
    select 1 from public.cases c
    where c.id = comments.case_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "Comments insert" on public.comments for insert with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.cases c
    where c.id = comments.case_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "Contributions select" on public.contributions for select using (
  public.is_case_member(case_id, auth.uid())
  or exists (select 1 from public.cases c where c.id = case_id and c.visibility = 'public')
);

create policy "Contributions insert" on public.contributions for insert with check (
  user_id = auth.uid()
  and (
    public.is_case_member(case_id, auth.uid())
    or exists (select 1 from public.cases c where c.id = case_id and c.visibility = 'public')
  )
);

create policy "Activity select" on public.activity_log for select using (
  public.is_case_member(case_id, auth.uid())
  or exists (select 1 from public.cases c where c.id = case_id and c.visibility = 'public')
);

create policy "Activity insert" on public.activity_log for insert with check (
  actor_id = auth.uid()
  and (
    public.is_case_member(case_id, auth.uid())
    or exists (select 1 from public.cases c where c.id = case_id and c.visibility = 'public')
  )
);

-- Realtime: in Supabase Dashboard → Database → Replication, add tables:
-- evidence_files, notes, comments, activity_log (or run 002_enable_realtime.sql after verifying publication exists)
