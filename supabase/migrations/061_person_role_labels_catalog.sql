-- Reusable investigation role labels for incident People combobox (search + add + dedupe).

create table if not exists public.person_role_labels (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  normalized text not null,
  created_at timestamptz not null default now(),
  unique (normalized)
);

create index if not exists idx_person_role_labels_label_lower on public.person_role_labels (lower(label));

alter table public.person_role_labels enable row level security;

drop policy if exists "person_role_labels select authenticated" on public.person_role_labels;
create policy "person_role_labels select authenticated" on public.person_role_labels
  for select to authenticated using (true);

drop policy if exists "person_role_labels insert authenticated" on public.person_role_labels;
create policy "person_role_labels insert authenticated" on public.person_role_labels
  for insert to authenticated with check (true);

comment on table public.person_role_labels is
  'Crowd-sourced person role labels for case/incident people pickers; deduplicated by normalized key (matches app platformNormalizedKey).';

-- Seed default roles (idempotent). Normalized = lower alphanumeric-only (see lib/source-platform.ts platformNormalizedKey).
insert into public.person_role_labels (label, normalized)
select v.label,
       regexp_replace(lower(trim(v.label)), '[^a-z0-9]+', '', 'g') as normalized
from (
  values
    ('Victim/Accuser'),
    ('Accused'),
    ('Employee'),
    ('FBI Investigator'),
    ('Officer'),
    ('Witness'),
    ('Government Official'),
    ('Police Officer')
) as v(label)
where length(regexp_replace(lower(trim(v.label)), '[^a-z0-9]+', '', 'g')) > 0
on conflict (normalized) do nothing;

-- Backfill distinct roles from existing case JSON.
insert into public.person_role_labels (label, normalized)
select max(trim(coalesce(elem->>'role', ''))) as label,
       regexp_replace(lower(trim(coalesce(elem->>'role', ''))), '[^a-z0-9]+', '', 'g') as normalized
from public.cases c,
lateral jsonb_array_elements(
  case when jsonb_typeof(c.case_people) = 'array' then c.case_people else '[]'::jsonb end
) as elem
where length(trim(coalesce(elem->>'role', ''))) > 0
  and length(regexp_replace(lower(trim(coalesce(elem->>'role', ''))), '[^a-z0-9]+', '', 'g')) > 0
group by regexp_replace(lower(trim(coalesce(elem->>'role', ''))), '[^a-z0-9]+', '', 'g')
on conflict (normalized) do nothing;

insert into public.person_role_labels (label, normalized)
select max(trim(coalesce(elem->>'role', ''))) as label,
       regexp_replace(lower(trim(coalesce(elem->>'role', ''))), '[^a-z0-9]+', '', 'g') as normalized
from public.cases c,
lateral jsonb_array_elements(
  case when jsonb_typeof(c.incident_entries) = 'array' then c.incident_entries else '[]'::jsonb end
) as inc,
lateral jsonb_array_elements(
  case when jsonb_typeof(inc->'people') = 'array' then inc->'people' else '[]'::jsonb end
) as elem
where length(trim(coalesce(elem->>'role', ''))) > 0
  and length(regexp_replace(lower(trim(coalesce(elem->>'role', ''))), '[^a-z0-9]+', '', 'g')) > 0
group by regexp_replace(lower(trim(coalesce(elem->>'role', ''))), '[^a-z0-9]+', '', 'g')
on conflict (normalized) do nothing;
