-- Opt-in investigator identity (separate from legal/display name), evidence view tracking, extraction outcome.

-- ---------------------------------------------------------------------------
-- Investigator fields on profiles (opt-in public wall + in-app persona)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists investigator_opt_in boolean not null default false;

alter table public.profiles
  add column if not exists investigator_alias text;

alter table public.profiles
  add column if not exists investigator_avatar_url text;

alter table public.profiles
  add column if not exists investigator_tagline text;

comment on column public.profiles.investigator_opt_in is
  'When true, user appears on Investigators wall and may show investigator alias/avatar in chat and comments.';

comment on column public.profiles.investigator_alias is
  'Optional public-facing investigator handle; not required to match display_name.';

-- ---------------------------------------------------------------------------
-- Per-user evidence library "viewed" tracking (for status bullets)
-- ---------------------------------------------------------------------------
create table if not exists public.evidence_file_views (
  user_id uuid not null references public.profiles (id) on delete cascade,
  evidence_file_id uuid not null references public.evidence_files (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, evidence_file_id)
);

create index if not exists idx_evidence_file_views_evidence on public.evidence_file_views (evidence_file_id);

alter table public.evidence_file_views enable row level security;

drop policy if exists "evidence_file_views select own" on public.evidence_file_views;
create policy "evidence_file_views select own" on public.evidence_file_views
  for select using (user_id = auth.uid());

drop policy if exists "evidence_file_views insert own" on public.evidence_file_views;
create policy "evidence_file_views insert own" on public.evidence_file_views
  for insert with check (user_id = auth.uid());

drop policy if exists "evidence_file_views update own" on public.evidence_file_views;
create policy "evidence_file_views update own" on public.evidence_file_views
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Extraction outcome (orthogonal to processing_status in several paths)
-- ---------------------------------------------------------------------------
alter table public.evidence_files
  add column if not exists extraction_status text not null default 'pending';

alter table public.evidence_files
  add column if not exists extraction_user_message text;

comment on column public.evidence_files.extraction_status is
  'pending | ok | failed | unavailable | retry_needed — user-facing extraction outcome; file may still be stored.';

comment on column public.evidence_files.extraction_user_message is
  'Optional short message shown when extraction fails or needs retry.';
