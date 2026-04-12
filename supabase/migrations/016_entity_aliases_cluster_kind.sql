-- Entity aliases (case-scoped, linked to canonical entities) + cluster kind / membership provenance.

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

-- entity_aliases RLS (mirror entities: read if case visible/member; write if can_write_case)
alter table public.entity_aliases enable row level security;

create policy "entity_aliases select" on public.entity_aliases for select using (
  exists (
    select 1 from public.cases c
    where c.id = entity_aliases.case_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "entity_aliases write" on public.entity_aliases for all using (
  public.can_write_case(case_id, auth.uid())
) with check (public.can_write_case(case_id, auth.uid()));
