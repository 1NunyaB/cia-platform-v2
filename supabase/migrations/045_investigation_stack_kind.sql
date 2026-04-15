-- Canonical investigation stacks (Location, People, …) — one row per case per kind.

alter table public.evidence_clusters
  add column if not exists stack_kind text;

alter table public.evidence_clusters
  drop constraint if exists evidence_clusters_stack_kind_check;

alter table public.evidence_clusters
  add constraint evidence_clusters_stack_kind_check
  check (
    stack_kind is null
    or stack_kind in (
      'location',
      'people',
      'objects',
      'transportation',
      'documents',
      'miscellaneous'
    )
  );

create unique index if not exists idx_evidence_clusters_case_stack_kind
  on public.evidence_clusters (case_id, stack_kind)
  where stack_kind is not null;

comment on column public.evidence_clusters.stack_kind is
  'Fixed investigation stack slot; null = user-created cluster without a canonical slot.';
