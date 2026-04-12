-- Collaboration: case note visibility, evidence sticky notes + replies, threaded comments,
-- dashboard workspace chat + rate state, persisted cluster AI analysis.

-- ---------------------------------------------------------------------------
-- Case notes visibility (case-level and evidence-level formal notes)
-- ---------------------------------------------------------------------------
alter table public.notes
  add column if not exists visibility text not null default 'shared_case'
  check (visibility in ('private', 'shared_case', 'public_case'));

drop policy if exists "Notes select" on public.notes;
create policy "Notes select" on public.notes for select using (
  exists (
    select 1 from public.cases c
    where c.id = notes.case_id
    and (
      (notes.visibility = 'private' and auth.uid() is not null and notes.author_id = auth.uid())
      or (notes.visibility = 'shared_case' and auth.uid() is not null and public.is_case_member(c.id, auth.uid()))
      or (notes.visibility = 'public_case' and c.visibility = 'public')
    )
  )
);

drop policy if exists "Notes insert" on public.notes;
create policy "Notes insert" on public.notes for insert with check (
  author_id = auth.uid()
  and auth.uid() is not null
  and exists (
    select 1 from public.cases c
    where c.id = notes.case_id
    and (
      c.visibility = 'public'
      or public.can_write_case(c.id, auth.uid())
      or (c.visibility = 'team' and public.is_case_member(c.id, auth.uid()))
    )
  )
);

-- ---------------------------------------------------------------------------
-- Threaded case comments
-- ---------------------------------------------------------------------------
alter table public.comments
  add column if not exists parent_comment_id uuid references public.comments (id) on delete cascade;

create index if not exists idx_comments_parent on public.comments (parent_comment_id);

-- ---------------------------------------------------------------------------
-- Evidence sticky notes (informal observations; distinct from formal notes)
-- ---------------------------------------------------------------------------
create table if not exists public.evidence_sticky_notes (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  evidence_file_id uuid not null references public.evidence_files (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  author_label text,
  body text not null check (char_length(body) <= 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_sticky_notes_evidence on public.evidence_sticky_notes (evidence_file_id);
create index if not exists idx_sticky_notes_case on public.evidence_sticky_notes (case_id);

create table if not exists public.evidence_sticky_note_replies (
  id uuid primary key default gen_random_uuid(),
  sticky_note_id uuid not null references public.evidence_sticky_notes (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  author_label text,
  body text not null check (char_length(body) <= 4000),
  created_at timestamptz not null default now()
);

create index if not exists idx_sticky_replies_sticky on public.evidence_sticky_note_replies (sticky_note_id);

alter table public.evidence_sticky_notes enable row level security;
alter table public.evidence_sticky_note_replies enable row level security;

create policy "sticky_notes select" on public.evidence_sticky_notes for select using (
  exists (
    select 1 from public.cases c
    where c.id = evidence_sticky_notes.case_id
    and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "sticky_notes insert" on public.evidence_sticky_notes for insert with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.cases c
    where c.id = evidence_sticky_notes.case_id
    and public.can_write_case(c.id, auth.uid())
  )
);

create policy "sticky_notes delete" on public.evidence_sticky_notes for delete using (
  author_id = auth.uid()
);

create policy "sticky_replies select" on public.evidence_sticky_note_replies for select using (
  exists (
    select 1 from public.evidence_sticky_notes sn
    join public.cases c on c.id = sn.case_id
    where sn.id = evidence_sticky_note_replies.sticky_note_id
    and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "sticky_replies insert" on public.evidence_sticky_note_replies for insert with check (
  author_id = auth.uid()
  and exists (
    select 1 from public.evidence_sticky_notes sn
    join public.cases c on c.id = sn.case_id
    where sn.id = evidence_sticky_note_replies.sticky_note_id
    and public.can_write_case(c.id, auth.uid())
  )
);

create policy "sticky_replies delete" on public.evidence_sticky_note_replies for delete using (
  author_id = auth.uid()
);

-- ---------------------------------------------------------------------------
-- Dashboard workspace chat (lightweight, global to logged-in users)
-- ---------------------------------------------------------------------------
create table if not exists public.dashboard_chat_messages (
  id uuid primary key default gen_random_uuid(),
  author_id uuid references public.profiles (id) on delete set null,
  author_label text,
  body text not null check (char_length(body) <= 2000),
  created_at timestamptz not null default now()
);

create index if not exists idx_dashboard_chat_created on public.dashboard_chat_messages (created_at desc);

create table if not exists public.dashboard_chat_rate_state (
  user_id uuid primary key references auth.users (id) on delete cascade,
  last_post_at timestamptz not null default to_timestamp(0),
  last_body text,
  burst_count int not null default 0,
  cooldown_until timestamptz
);

alter table public.dashboard_chat_messages enable row level security;
alter table public.dashboard_chat_rate_state enable row level security;

create policy "dashboard_chat_messages select" on public.dashboard_chat_messages for select using (
  auth.uid() is not null
);

create policy "dashboard_chat_messages insert" on public.dashboard_chat_messages for insert with check (
  author_id = auth.uid()
);

create policy "dashboard_chat_rate own" on public.dashboard_chat_rate_state for all using (user_id = auth.uid())
with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Persisted AI analysis for evidence clusters (structured finding JSON)
-- ---------------------------------------------------------------------------
create table if not exists public.evidence_cluster_analyses (
  id uuid primary key default gen_random_uuid(),
  cluster_id uuid not null references public.evidence_clusters (id) on delete cascade,
  case_id uuid not null references public.cases (id) on delete cascade,
  structured jsonb not null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_evidence_cluster_analyses_one_per_cluster
  on public.evidence_cluster_analyses (cluster_id);

create index if not exists idx_evidence_cluster_analyses_case on public.evidence_cluster_analyses (case_id);

alter table public.evidence_cluster_analyses enable row level security;

create policy "cluster_analyses select" on public.evidence_cluster_analyses for select using (
  exists (
    select 1 from public.cases c
    where c.id = evidence_cluster_analyses.case_id
    and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "cluster_analyses write" on public.evidence_cluster_analyses for all using (
  public.can_write_case(case_id, auth.uid())
) with check (
  public.can_write_case(case_id, auth.uid())
);
