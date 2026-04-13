-- Catch-up (idempotent): schema required by evidence cluster analysis + listing.
-- Source migrations: 007_ensure_investigation_graph (cluster tables), 016_entity_aliases_cluster_kind,
-- 008_collaboration (evidence_cluster_analyses).
-- Run on a Supabase DB that is behind those migrations. Safe to re-run.

-- ---------------------------------------------------------------------------
-- evidence_clusters + evidence_cluster_members (007)
-- ---------------------------------------------------------------------------
create table if not exists public.evidence_clusters (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  title text,
  rationale text,
  ai_analysis_id uuid references public.ai_analyses (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_evidence_clusters_case on public.evidence_clusters (case_id);

create table if not exists public.evidence_cluster_members (
  cluster_id uuid not null references public.evidence_clusters (id) on delete cascade,
  evidence_file_id uuid not null references public.evidence_files (id) on delete cascade,
  primary key (cluster_id, evidence_file_id)
);

create index if not exists idx_cluster_members_evidence on public.evidence_cluster_members (evidence_file_id);

alter table public.evidence_clusters enable row level security;
alter table public.evidence_cluster_members enable row level security;

drop policy if exists "evidence_clusters select" on public.evidence_clusters;
create policy "evidence_clusters select" on public.evidence_clusters for select using (
  exists (
    select 1 from public.cases c
    where c.id = evidence_clusters.case_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

drop policy if exists "evidence_clusters write" on public.evidence_clusters;
create policy "evidence_clusters write" on public.evidence_clusters for all using (
  public.can_write_case(case_id, auth.uid())
) with check (public.can_write_case(case_id, auth.uid()));

drop policy if exists "cluster_members select" on public.evidence_cluster_members;
create policy "cluster_members select" on public.evidence_cluster_members for select using (
  exists (
    select 1 from public.evidence_clusters cl
    join public.cases c on c.id = cl.case_id
    where cl.id = evidence_cluster_members.cluster_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

drop policy if exists "cluster_members write" on public.evidence_cluster_members;
create policy "cluster_members write" on public.evidence_cluster_members for all using (
  exists (
    select 1 from public.evidence_clusters cl
    where cl.id = evidence_cluster_members.cluster_id
      and public.can_write_case(cl.case_id, auth.uid())
  )
) with check (
  exists (
    select 1 from public.evidence_clusters cl
    where cl.id = evidence_cluster_members.cluster_id
      and public.can_write_case(cl.case_id, auth.uid())
  )
);

-- ---------------------------------------------------------------------------
-- cluster_kind + link_source + entity_aliases (016) — used by cluster UI + listEntitiesWithCategories
-- ---------------------------------------------------------------------------
create table if not exists public.entity_aliases (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  entity_id uuid not null references public.entities (id) on delete cascade,
  alias_display text not null,
  alias_normalized text not null,
  strength text not null default 'moderate'
    check (strength in ('weak', 'moderate', 'strong')),
  source text not null default 'analysis'
    check (source in ('analysis', 'manual')),
  evidence_file_id uuid references public.evidence_files (id) on delete set null,
  ai_analysis_id uuid references public.ai_analyses (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (entity_id, alias_normalized)
);

create index if not exists idx_entity_aliases_case_norm on public.entity_aliases (case_id, alias_normalized);
create index if not exists idx_entity_aliases_entity on public.entity_aliases (entity_id);

alter table public.evidence_clusters
  add column if not exists cluster_kind text not null default 'standard'
  check (cluster_kind in ('standard', 'alias_focused'));

alter table public.evidence_cluster_members
  add column if not exists link_source text
  check (link_source is null or link_source in ('standard', 'alias_resolution'));

alter table public.entity_aliases enable row level security;

drop policy if exists "entity_aliases select" on public.entity_aliases;
create policy "entity_aliases select" on public.entity_aliases for select using (
  exists (
    select 1 from public.cases c
    where c.id = entity_aliases.case_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

drop policy if exists "entity_aliases write" on public.entity_aliases;
create policy "entity_aliases write" on public.entity_aliases for all using (
  public.can_write_case(case_id, auth.uid())
) with check (public.can_write_case(case_id, auth.uid()));

-- ---------------------------------------------------------------------------
-- evidence_cluster_analyses (008) — persisted cluster AI findings
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

drop policy if exists "cluster_analyses select" on public.evidence_cluster_analyses;
create policy "cluster_analyses select" on public.evidence_cluster_analyses for select using (
  exists (
    select 1 from public.cases c
    where c.id = evidence_cluster_analyses.case_id
    and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

drop policy if exists "cluster_analyses write" on public.evidence_cluster_analyses;
create policy "cluster_analyses write" on public.evidence_cluster_analyses for all using (
  public.can_write_case(case_id, auth.uid())
) with check (
  public.can_write_case(case_id, auth.uid())
);

-- ---------------------------------------------------------------------------
-- Optional: realtime (017) — ignore if already subscribed
-- ---------------------------------------------------------------------------
-- Optional: add evidence_clusters to supabase_realtime for live UI (see 017_evidence_source_and_case_index.sql).
