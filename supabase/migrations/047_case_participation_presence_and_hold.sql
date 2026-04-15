alter table public.cases
  add column if not exists investigation_on_hold_at timestamptz;

alter table public.cases
  add column if not exists investigation_on_hold_by uuid references public.profiles (id) on delete set null;

alter table public.case_members
  add column if not exists investigator_presence text not null default 'active'
  check (investigator_presence in ('active', 'away'));

alter table public.case_members
  add column if not exists presence_updated_at timestamptz not null default now();

create index if not exists idx_cases_hold_state on public.cases (investigation_on_hold_at desc nulls last);
create index if not exists idx_case_members_presence on public.case_members (case_id, investigator_presence);

comment on column public.cases.investigation_on_hold_at is
  'Global case hold timestamp; null when active.';
comment on column public.cases.investigation_on_hold_by is
  'User that put the case on hold globally.';
comment on column public.case_members.investigator_presence is
  'Per-user participation state for this case: active or away.';

