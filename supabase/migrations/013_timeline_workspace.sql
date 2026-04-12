-- Timeline workspace: custom lanes + per-user theory (hypothesis) placements without mutating canonical dates.

do $$ begin
  alter type public.timeline_kind add value 'custom';
exception
  when duplicate_object then null;
end $$;

alter table public.timeline_events
  add column if not exists custom_lane_label text;

comment on column public.timeline_events.custom_lane_label is
  'When timeline_kind is custom, investigator-visible name for that parallel lane.';

create table if not exists public.timeline_theory_placements (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  timeline_event_id uuid not null references public.timeline_events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  provisional_occurred_at timestamptz not null,
  revision_history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now(),
  unique (timeline_event_id, user_id)
);

create index if not exists idx_theory_placements_case_user on public.timeline_theory_placements (case_id, user_id);

comment on table public.timeline_theory_placements is
  'Hypothesis-only time positions in Theory mode; Timeline 1 (confirmed) events cannot be moved here.';

alter table public.timeline_theory_placements enable row level security;

create policy "theory placements select" on public.timeline_theory_placements for select using (
  exists (
    select 1 from public.cases c
    where c.id = timeline_theory_placements.case_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "theory placements write" on public.timeline_theory_placements for all using (
  public.can_write_case(case_id, auth.uid())
) with check (
  public.can_write_case(case_id, auth.uid())
);
