-- Visual object/feature tags for image evidence.
-- Designed for non-identity labeling (objects/scenes/features), not facial identification.

create table if not exists public.evidence_visual_tags (
  id uuid primary key default gen_random_uuid(),
  evidence_file_id uuid not null references public.evidence_files (id) on delete cascade,
  tag text not null,
  confidence numeric(4,3),
  source text not null default 'heuristic',
  created_at timestamptz not null default now()
);

create index if not exists idx_evidence_visual_tags_evidence on public.evidence_visual_tags (evidence_file_id);
create index if not exists idx_evidence_visual_tags_tag_lower on public.evidence_visual_tags (lower(tag));
create unique index if not exists idx_evidence_visual_tags_unique
  on public.evidence_visual_tags (evidence_file_id, lower(tag), source);

alter table public.evidence_visual_tags enable row level security;

drop policy if exists "Visual tags select" on public.evidence_visual_tags;
create policy "Visual tags select" on public.evidence_visual_tags for select using (
  exists (
    select 1
    from public.evidence_files e
    left join public.cases c on c.id = e.case_id
    where e.id = evidence_visual_tags.evidence_file_id
      and (
        (e.case_id is not null and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid())))
        or (e.case_id is null and e.uploaded_by = auth.uid())
        or exists (
          select 1
          from public.evidence_case_memberships m
          join public.cases c2 on c2.id = m.case_id
          where m.evidence_file_id = e.id
            and (c2.visibility = 'public' or public.is_case_member(c2.id, auth.uid()))
        )
      )
  )
);

drop policy if exists "Visual tags write" on public.evidence_visual_tags;
create policy "Visual tags write" on public.evidence_visual_tags for all using (
  exists (
    select 1 from public.evidence_files e
    where e.id = evidence_visual_tags.evidence_file_id
      and (
        (e.case_id is not null and public.can_write_case(e.case_id, auth.uid()))
        or (e.case_id is null and e.uploaded_by = auth.uid())
      )
  )
) with check (
  exists (
    select 1 from public.evidence_files e
    where e.id = evidence_visual_tags.evidence_file_id
      and (
        (e.case_id is not null and public.can_write_case(e.case_id, auth.uid()))
        or (e.case_id is null and e.uploaded_by = auth.uid())
      )
  )
);

comment on table public.evidence_visual_tags is
  'Non-identity visual object/feature labels for image evidence search and triage.';

