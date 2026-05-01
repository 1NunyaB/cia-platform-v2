-- User-extendable option lists: cities per state, source programs, source site hosts.

-- Cities (per U.S. state code or OTHER); merges with static UI list in app code.
create table if not exists public.city_options (
  id uuid primary key default gen_random_uuid(),
  state_code text not null,
  label text not null,
  normalized text not null,
  created_at timestamptz not null default now(),
  unique (state_code, normalized)
);

create index if not exists idx_city_options_state on public.city_options (state_code);

alter table public.city_options enable row level security;

drop policy if exists "city_options select authenticated" on public.city_options;
create policy "city_options select authenticated" on public.city_options
  for select to authenticated using (true);

drop policy if exists "city_options insert authenticated" on public.city_options;
create policy "city_options insert authenticated" on public.city_options
  for insert to authenticated with check (true);

comment on table public.city_options is
  'User-added city names per state (or OTHER); deduplicated by normalized key.';

-- Program / show / title — same pattern as source_platforms.
create table if not exists public.source_programs (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  normalized text not null,
  created_at timestamptz not null default now(),
  unique (normalized)
);

create index if not exists idx_source_programs_label_lower on public.source_programs (lower(label));

alter table public.source_programs enable row level security;

drop policy if exists "source_programs select authenticated" on public.source_programs;
create policy "source_programs select authenticated" on public.source_programs
  for select to authenticated using (true);

drop policy if exists "source_programs insert authenticated" on public.source_programs;
create policy "source_programs insert authenticated" on public.source_programs
  for insert to authenticated with check (true);

comment on table public.source_programs is
  'Crowd-sourced program/show/title labels for evidence source metadata.';

-- Source site host hints (e.g. wikipedia.org) for grouping.
create table if not exists public.source_site_hosts (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  normalized text not null,
  created_at timestamptz not null default now(),
  unique (normalized)
);

create index if not exists idx_source_site_hosts_label_lower on public.source_site_hosts (lower(label));

alter table public.source_site_hosts enable row level security;

drop policy if exists "source_site_hosts select authenticated" on public.source_site_hosts;
create policy "source_site_hosts select authenticated" on public.source_site_hosts
  for select to authenticated using (true);

drop policy if exists "source_site_hosts insert authenticated" on public.source_site_hosts;
create policy "source_site_hosts insert authenticated" on public.source_site_hosts
  for insert to authenticated with check (true);

comment on table public.source_site_hosts is
  'User-added source site hostnames for evidence grouping; deduplicated by normalized key.';
