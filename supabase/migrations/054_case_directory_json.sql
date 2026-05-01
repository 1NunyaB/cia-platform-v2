-- Repeatable incidents, parties, legal milestones, and evidence-in-files registry (JSON arrays).

alter table public.cases add column if not exists incidents jsonb not null default '[]'::jsonb;
alter table public.cases add column if not exists case_victims jsonb not null default '[]'::jsonb;
alter table public.cases add column if not exists case_accused jsonb not null default '[]'::jsonb;
alter table public.cases add column if not exists legal_milestones jsonb not null default '[]'::jsonb;
alter table public.cases add column if not exists evidence_file_entries jsonb not null default '[]'::jsonb;

comment on column public.cases.incidents is
  'Array of { city, state, year } incident locations (UI uses state/city dropdowns).';

comment on column public.cases.case_victims is
  'JSON array of victim name/label strings.';

comment on column public.cases.case_accused is
  'JSON array of accused / defendant name strings.';

comment on column public.cases.legal_milestones is
  'Array of { type, month_year, sentence_detail? } for indictment, conviction, acquittal, dismissal.';

comment on column public.cases.evidence_file_entries is
  'Optional catalog of evidence references found in case files (label, file_reference, notes).';

-- Backfill from legacy scalar columns where structured data is empty.
update public.cases
set incidents = case
  when coalesce(incidents, '[]'::jsonb) = '[]'::jsonb
    and (
      (incident_city is not null and trim(incident_city) <> '')
      or (incident_state is not null and trim(incident_state) <> '')
      or incident_year is not null
    )
  then jsonb_build_array(
      jsonb_build_object(
        'city', coalesce(nullif(trim(incident_city), ''), ''),
        'state', coalesce(nullif(trim(incident_state), ''), ''),
        'year', incident_year
      )
    )
  else coalesce(incidents, '[]'::jsonb)
end
where true;

update public.cases
set case_victims = case
  when coalesce(case_victims, '[]'::jsonb) = '[]'::jsonb
    and victim_labels is not null
    and trim(victim_labels) <> ''
  then coalesce(
      (
        select jsonb_agg(trim(x)::text)
        from unnest(string_to_array(victim_labels, ',')) as x
        where length(trim(x)) > 0
      ),
      '[]'::jsonb
    )
  else coalesce(case_victims, '[]'::jsonb)
end
where true;

update public.cases
set case_accused = case
  when coalesce(case_accused, '[]'::jsonb) = '[]'::jsonb
    and accused_label is not null
    and trim(accused_label) <> ''
  then jsonb_build_array(trim(accused_label::text))
  else coalesce(case_accused, '[]'::jsonb)
end
where true;

update public.cases c
set legal_milestones = (
  select coalesce(jsonb_agg(elem order by ord), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'type', 'indictment',
      'month_year', trim(c.indictment_month_year::text)
    ) as elem,
      0 as ord
    where c.indictment_month_year is not null
      and trim(c.indictment_month_year::text) <> ''
    union all
    select jsonb_build_object(
      'type', 'conviction',
      'month_year', trim(c.conviction_month_year::text),
      'sentence_detail', c.sentence
    ),
      1
    where c.conviction_month_year is not null
      and trim(c.conviction_month_year::text) <> ''
  ) t
)
where coalesce(c.legal_milestones, '[]'::jsonb) = '[]'::jsonb
  and (
    (c.indictment_month_year is not null and trim(c.indictment_month_year::text) <> '')
    or (c.conviction_month_year is not null and trim(c.conviction_month_year::text) <> '')
  );
