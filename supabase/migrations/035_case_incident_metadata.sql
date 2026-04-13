-- Structured incident metadata for investigations (search, display, future reporting).

alter table public.cases
  add column if not exists incident_year integer;

alter table public.cases
  add column if not exists incident_city text;

alter table public.cases
  add column if not exists incident_state text;

alter table public.cases
  add column if not exists accused_label text;

alter table public.cases
  add column if not exists victim_labels text;

alter table public.cases
  add column if not exists known_weapon text;

comment on column public.cases.incident_year is
  'Calendar year of the incident when known; optional.';

comment on column public.cases.incident_city is
  'City or locality associated with the incident when known.';

comment on column public.cases.incident_state is
  'State, province, or region (free text; often US state name or abbreviation).';

comment on column public.cases.accused_label is
  'Primary accused or defendant name/label for directory search (not a legal finding).';

comment on column public.cases.victim_labels is
  'Victim name(s) or labels; free text for search (comma- or line-separated).';

comment on column public.cases.known_weapon is
  'Alleged or known weapon description when relevant to the investigation.';
