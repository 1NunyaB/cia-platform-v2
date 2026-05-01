-- Grouped incident blocks (people, charges, legal actions, evidence per incident).
alter table public.cases add column if not exists incident_entries jsonb not null default '[]'::jsonb;

comment on column public.cases.incident_entries is
  'Array of incident blocks: each includes narrative, location, people[], charges, legal_milestones[], evidence_items[]. Legacy columns remain populated from flattened view.';
