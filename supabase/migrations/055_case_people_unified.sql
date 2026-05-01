-- Unified people list { name, role }. Legacy case_victims / case_accused remain populated on write for search.

alter table public.cases add column if not exists case_people jsonb not null default '[]'::jsonb;

comment on column public.cases.case_people is
  'JSON array of { name, role } for victims, accusers, and custom roles.';

comment on column public.cases.incidents is
  'Array of incident rows: { description, date?, city?, state?, year? }.';
