-- Investigation graph: multi-category entities, evidence clusters, timeline ↔ evidence M:N
-- Run after 001 (and 002 storage if used).

do $$ begin
  create type investigation_category as enum (
    'core_actors',
    'money',
    'political',
    'tech',
    'intel',
    'convicted',
    'accusers',
    'accused',
    'dead'
  );
exception when duplicate_object then null;
end $$;

-- One canonical entity row per case per normalized label (cross-evidence linkage)
create unique index if not exists idx_entities_case_canonical_label
  on public.entities (case_id, (lower(btrim(label))));

create table if not exists public.entity_categories (
  entity_id uuid not null references public.entities (id) on delete cascade,
  category investigation_category not null,
  primary key (entity_id, category)
);

create index if not exists idx_entity_categories_category on public.entity_categories (category);

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

create table if not exists public.timeline_event_evidence (
  timeline_event_id uuid not null references public.timeline_events (id) on delete cascade,
  evidence_file_id uuid not null references public.evidence_files (id) on delete cascade,
  primary key (timeline_event_id, evidence_file_id)
);

create index if not exists idx_timeline_event_evidence_file on public.timeline_event_evidence (evidence_file_id);

create table if not exists public.evidence_links (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  source_evidence_file_id uuid not null references public.evidence_files (id) on delete cascade,
  target_evidence_file_id uuid not null references public.evidence_files (id) on delete cascade,
  ai_analysis_id uuid references public.ai_analyses (id) on delete set null,
  link_type text not null default 'related',
  description text,
  created_at timestamptz not null default now()
);

create unique index if not exists idx_evidence_links_unique_pair
  on public.evidence_links (case_id, source_evidence_file_id, target_evidence_file_id, link_type);

create index if not exists idx_evidence_links_case on public.evidence_links (case_id);

-- RLS
alter table public.entity_categories enable row level security;
alter table public.evidence_clusters enable row level security;
alter table public.evidence_cluster_members enable row level security;
alter table public.timeline_event_evidence enable row level security;
alter table public.evidence_links enable row level security;

create policy "entity_categories select" on public.entity_categories for select using (
  exists (
    select 1 from public.entities en
    join public.cases c on c.id = en.case_id
    where en.id = entity_categories.entity_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "entity_categories write" on public.entity_categories for all using (
  exists (
    select 1 from public.entities en
    where en.id = entity_categories.entity_id
      and public.can_write_case(en.case_id, auth.uid())
  )
) with check (
  exists (
    select 1 from public.entities en
    where en.id = entity_categories.entity_id
      and public.can_write_case(en.case_id, auth.uid())
  )
);

create policy "evidence_clusters select" on public.evidence_clusters for select using (
  exists (
    select 1 from public.cases c
    where c.id = evidence_clusters.case_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "evidence_clusters write" on public.evidence_clusters for all using (
  public.can_write_case(case_id, auth.uid())
) with check (public.can_write_case(case_id, auth.uid()));

create policy "cluster_members select" on public.evidence_cluster_members for select using (
  exists (
    select 1 from public.evidence_clusters cl
    join public.cases c on c.id = cl.case_id
    where cl.id = evidence_cluster_members.cluster_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

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

create policy "timeline_event_evidence select" on public.timeline_event_evidence for select using (
  exists (
    select 1 from public.timeline_events te
    join public.cases c on c.id = te.case_id
    where te.id = timeline_event_evidence.timeline_event_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "timeline_event_evidence write" on public.timeline_event_evidence for all using (
  exists (
    select 1 from public.timeline_events te
    where te.id = timeline_event_evidence.timeline_event_id
      and public.can_write_case(te.case_id, auth.uid())
  )
) with check (
  exists (
    select 1 from public.timeline_events te
    where te.id = timeline_event_evidence.timeline_event_id
      and public.can_write_case(te.case_id, auth.uid())
  )
);

create policy "evidence_links select" on public.evidence_links for select using (
  exists (
    select 1 from public.cases c
    where c.id = evidence_links.case_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "evidence_links write" on public.evidence_links for all using (
  public.can_write_case(case_id, auth.uid())
) with check (public.can_write_case(case_id, auth.uid()));
