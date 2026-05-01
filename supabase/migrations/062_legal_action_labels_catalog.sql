-- Reusable legal action labels for incident Legal actions combobox (search + add + dedupe).

create table if not exists public.legal_action_labels (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  normalized text not null,
  created_at timestamptz not null default now(),
  unique (normalized)
);

create index if not exists idx_legal_action_labels_label_lower on public.legal_action_labels (lower(label));

alter table public.legal_action_labels enable row level security;

drop policy if exists "legal_action_labels select authenticated" on public.legal_action_labels;
create policy "legal_action_labels select authenticated" on public.legal_action_labels
  for select to authenticated using (true);

drop policy if exists "legal_action_labels insert authenticated" on public.legal_action_labels;
create policy "legal_action_labels insert authenticated" on public.legal_action_labels
  for insert to authenticated with check (true);

comment on table public.legal_action_labels is
  'Crowd-sourced legal milestone action labels; deduplicated by normalized key (matches app platform-style normalization).';

-- Seed default actions (idempotent).
insert into public.legal_action_labels (label, normalized)
select v.label,
       regexp_replace(lower(trim(v.label)), '[^a-z0-9]+', '', 'g') as normalized
from (
  values
    ('Investigation Opened'),
    ('Indictment'),
    ('Conviction'),
    ('Acquittal'),
    ('Dismissal'),
    ('Search Warrant'),
    ('Deal Made')
) as v(label)
where length(regexp_replace(lower(trim(v.label)), '[^a-z0-9]+', '', 'g')) > 0
on conflict (normalized) do nothing;

-- Backfill from case-level legal_milestones JSON (map legacy slugs to display labels).
insert into public.legal_action_labels (label, normalized)
select max(mapped) as label,
       regexp_replace(lower(trim(max(mapped))), '[^a-z0-9]+', '', 'g') as normalized
from public.cases c,
lateral jsonb_array_elements(
  case when jsonb_typeof(c.legal_milestones) = 'array' then c.legal_milestones else '[]'::jsonb end
) as elem,
lateral (
  select
    case lower(trim(coalesce(elem->>'type', '')))
      when 'investigation_opened' then 'Investigation Opened'
      when 'indictment' then 'Indictment'
      when 'search_warrant' then 'Search Warrant'
      when 'conviction' then 'Conviction'
      when 'acquittal' then 'Acquittal'
      when 'dismissal' then 'Dismissal'
      else trim(coalesce(elem->>'type', ''))
    end as mapped
) x
where length(trim(coalesce(elem->>'type', ''))) > 0
  and length(regexp_replace(lower(trim(x.mapped)), '[^a-z0-9]+', '', 'g')) > 0
group by regexp_replace(lower(trim(x.mapped)), '[^a-z0-9]+', '', 'g')
on conflict (normalized) do nothing;

-- Backfill from incident_entries[].legal_milestones.
insert into public.legal_action_labels (label, normalized)
select max(mapped) as label,
       regexp_replace(lower(trim(max(mapped))), '[^a-z0-9]+', '', 'g') as normalized
from public.cases c,
lateral jsonb_array_elements(
  case when jsonb_typeof(c.incident_entries) = 'array' then c.incident_entries else '[]'::jsonb end
) as inc,
lateral jsonb_array_elements(
  case when jsonb_typeof(inc->'legal_milestones') = 'array' then inc->'legal_milestones' else '[]'::jsonb end
) as elem,
lateral (
  select
    case lower(trim(coalesce(elem->>'type', '')))
      when 'investigation_opened' then 'Investigation Opened'
      when 'indictment' then 'Indictment'
      when 'search_warrant' then 'Search Warrant'
      when 'conviction' then 'Conviction'
      when 'acquittal' then 'Acquittal'
      when 'dismissal' then 'Dismissal'
      else trim(coalesce(elem->>'type', ''))
    end as mapped
) x
where length(trim(coalesce(elem->>'type', ''))) > 0
  and length(regexp_replace(lower(trim(x.mapped)), '[^a-z0-9]+', '', 'g')) > 0
group by regexp_replace(lower(trim(x.mapped)), '[^a-z0-9]+', '', 'g')
on conflict (normalized) do nothing;
