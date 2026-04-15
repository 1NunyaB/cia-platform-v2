alter table public.cases
  add column if not exists investigation_started_at timestamptz;

alter table public.cases
  add column if not exists investigation_started_by uuid references public.profiles (id) on delete set null;

create index if not exists idx_cases_started_at on public.cases (investigation_started_at desc nulls last);

comment on column public.cases.investigation_started_at is
  'When first actively started in-app; null means case exists but has not been started.';

comment on column public.cases.investigation_started_by is
  'User who initiated in-app start of the investigation.';

