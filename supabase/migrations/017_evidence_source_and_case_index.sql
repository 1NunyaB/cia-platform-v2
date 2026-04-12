-- Structured source metadata on evidence + victims investigation category + realtime for live index.

-- Source fields (defaults preserve legacy rows)
alter table public.evidence_files
  add column if not exists source_type text not null default 'unknown'
    check (source_type in (
      'website', 'broadcast', 'program', 'podcast', 'video', 'article', 'social', 'other', 'unknown'
    ));

alter table public.evidence_files
  add column if not exists source_platform text;

alter table public.evidence_files
  add column if not exists source_program text;

alter table public.evidence_files
  add column if not exists source_url text;

comment on column public.evidence_files.source_type is
  'Kind of origin: website, broadcast, program, podcast, video, article, social, other, unknown.';
comment on column public.evidence_files.source_platform is
  'Network or platform (e.g. CNN, YouTube, X).';
comment on column public.evidence_files.source_program is
  'Show, episode, program, or post title when applicable.';
comment on column public.evidence_files.source_url is
  'Canonical URL when the item came from the web or a share link.';

create index if not exists idx_evidence_files_case_source_platform
  on public.evidence_files (case_id, source_platform)
  where source_platform is not null;

-- Victims category (parallel to accusers / accused)
alter type public.investigation_category add value if not exists 'victims';

-- Realtime: index-relevant tables (ignore if already published)
do $$
begin
  begin
    alter publication supabase_realtime add table public.entities;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.entity_aliases;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.timeline_events;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.evidence_clusters;
  exception when others then null;
  end;
  begin
    alter publication supabase_realtime add table public.timeline_event_evidence;
  exception when others then null;
  end;
end $$;
