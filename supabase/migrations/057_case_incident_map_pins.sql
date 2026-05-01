-- Automatic map pins for incident entries: city + state (optional future address_line).
-- Coordinates are set only when resolvable (app-side); rows may exist with null lat/lon until then.

create table if not exists public.case_incident_map_pins (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases (id) on delete cascade,
  incident_entry_id text not null check (char_length(incident_entry_id) <= 80),
  label text not null default '' check (char_length(label) <= 600),
  city text not null default '' check (char_length(city) <= 200),
  state text not null default '' check (char_length(state) <= 100),
  address_line text check (address_line is null or char_length(address_line) <= 2000),
  latitude double precision,
  longitude double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, incident_entry_id),
  constraint case_incident_map_pins_coords_consistent check (
    (latitude is null and longitude is null)
    or (
      latitude is not null
      and longitude is not null
      and latitude between -90::double precision and 90::double precision
      and longitude between -180::double precision and 180::double precision
    )
  )
);

create index if not exists idx_case_incident_map_pins_case on public.case_incident_map_pins (case_id);

comment on table public.case_incident_map_pins is
  'Denormalized pins for incident entry locations; synced from cases.incident_entries JSON on save.';

drop trigger if exists case_incident_map_pins_updated_at on public.case_incident_map_pins;
create trigger case_incident_map_pins_updated_at
  before update on public.case_incident_map_pins
  for each row execute function public.set_updated_at();

alter table public.case_incident_map_pins enable row level security;

create policy "case_incident_map_pins select" on public.case_incident_map_pins for select using (
  exists (
    select 1 from public.cases c
    where c.id = case_incident_map_pins.case_id
      and (c.visibility = 'public' or public.is_case_member(c.id, auth.uid()))
  )
);

create policy "case_incident_map_pins insert" on public.case_incident_map_pins for insert with check (
  public.can_write_case(case_id, auth.uid())
);

create policy "case_incident_map_pins update" on public.case_incident_map_pins for update using (
  public.can_write_case(case_id, auth.uid())
);

create policy "case_incident_map_pins delete" on public.case_incident_map_pins for delete using (
  public.can_write_case(case_id, auth.uid())
);
