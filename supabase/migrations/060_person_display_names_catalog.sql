-- Reusable person display names for incident People combobox (search + add + dedupe by normalized key).

create table if not exists public.person_display_names (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  normalized text not null,
  created_at timestamptz not null default now(),
  unique (normalized)
);

create index if not exists idx_person_display_names_label_lower on public.person_display_names (lower(label));

alter table public.person_display_names enable row level security;

drop policy if exists "person_display_names select authenticated" on public.person_display_names;
create policy "person_display_names select authenticated" on public.person_display_names
  for select to authenticated using (true);

drop policy if exists "person_display_names insert authenticated" on public.person_display_names;
create policy "person_display_names insert authenticated" on public.person_display_names
  for insert to authenticated with check (true);

comment on table public.person_display_names is
  'Crowd-sourced person names for incident/case people pickers; deduplicated by normalized key.';

-- Backfill distinct names from existing case JSON (best-effort, idempotent).
insert into public.person_display_names (label, normalized)
select max(trim(coalesce(elem->>'name', ''))) as label,
       lower(regexp_replace(trim(coalesce(elem->>'name', '')), '\s+', ' ', 'g')) as normalized
from public.cases c,
lateral jsonb_array_elements(
  case when jsonb_typeof(c.case_people) = 'array' then c.case_people else '[]'::jsonb end
) as elem
where length(trim(coalesce(elem->>'name', ''))) > 0
  and length(
    lower(regexp_replace(trim(coalesce(elem->>'name', '')), '\s+', ' ', 'g'))
  ) > 0
group by lower(regexp_replace(trim(coalesce(elem->>'name', '')), '\s+', ' ', 'g'))
on conflict (normalized) do nothing;

insert into public.person_display_names (label, normalized)
select max(trim(coalesce(elem->>'name', ''))) as label,
       lower(regexp_replace(trim(coalesce(elem->>'name', '')), '\s+', ' ', 'g')) as normalized
from public.cases c,
lateral jsonb_array_elements(
  case when jsonb_typeof(c.incident_entries) = 'array' then c.incident_entries else '[]'::jsonb end
) as inc,
lateral jsonb_array_elements(
  case when jsonb_typeof(inc->'people') = 'array' then inc->'people' else '[]'::jsonb end
) as elem
where length(trim(coalesce(elem->>'name', ''))) > 0
  and length(
    lower(regexp_replace(trim(coalesce(elem->>'name', '')), '\s+', ' ', 'g'))
  ) > 0
group by lower(regexp_replace(trim(coalesce(elem->>'name', '')), '\s+', ' ', 'g'))
on conflict (normalized) do nothing;
