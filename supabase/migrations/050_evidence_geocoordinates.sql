-- Map pins: optional lat/lon on evidence_files; pins shown only for location image category + valid coordinates.

alter table public.evidence_files
  add column if not exists latitude double precision;

alter table public.evidence_files
  add column if not exists longitude double precision;

comment on column public.evidence_files.latitude is
  'WGS84 latitude when set with longitude; used by Location map for location-category evidence.';

comment on column public.evidence_files.longitude is
  'WGS84 longitude when set with latitude; used by Location map for location-category evidence.';

alter table public.evidence_files drop constraint if exists evidence_files_lat_lon_pair_chk;

alter table public.evidence_files
  add constraint evidence_files_lat_lon_pair_chk check (
    (latitude is null and longitude is null)
    or (
      latitude is not null
      and longitude is not null
      and latitude between -90::double precision and 90::double precision
      and longitude between -180::double precision and 180::double precision
    )
  );

create index if not exists idx_evidence_files_location_map_pins
  on public.evidence_files (image_category)
  where image_category = 'location'
    and latitude is not null
    and longitude is not null;
