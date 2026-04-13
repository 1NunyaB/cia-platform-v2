-- Reusable platform/network labels for evidence source metadata (upload combobox + dedup).

create table if not exists public.source_platforms (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  normalized text not null,
  created_at timestamptz not null default now(),
  unique (normalized)
);

create index if not exists idx_source_platforms_label_lower on public.source_platforms (lower(label));

alter table public.source_platforms enable row level security;

drop policy if exists "source_platforms select authenticated" on public.source_platforms;
create policy "source_platforms select authenticated" on public.source_platforms
  for select to authenticated using (true);

drop policy if exists "source_platforms insert authenticated" on public.source_platforms;
create policy "source_platforms insert authenticated" on public.source_platforms
  for insert to authenticated with check (true);

comment on table public.source_platforms is
  'Crowd-sourced canonical platform/network names; deduplicated by normalized key.';

-- Seed common networks (idempotent).
insert into public.source_platforms (label, normalized) values
  ('CNN', 'cnn'),
  ('Fox News', 'foxnews'),
  ('CBSN', 'cbsn'),
  ('C-SPAN', 'cspan'),
  ('MSNBC', 'msnbc'),
  ('CNBC', 'cnbc'),
  ('ABC News', 'abcnews'),
  ('NBC News', 'nbcnews'),
  ('BBC', 'bbc'),
  ('NPR', 'npr'),
  ('PBS', 'pbs'),
  ('YouTube', 'youtube'),
  ('X', 'twitter'),
  ('Facebook', 'facebook'),
  ('Instagram', 'instagram'),
  ('TikTok', 'tiktok'),
  ('LinkedIn', 'linkedin'),
  ('Reddit', 'reddit'),
  ('Spotify', 'spotify'),
  ('Apple Podcasts', 'applepodcasts'),
  ('Google Podcasts', 'googlepodcasts'),
  ('Amazon Music', 'amazonmusic'),
  ('Anchor', 'anchor'),
  ('Bloomberg', 'bloomberg'),
  ('Reuters', 'reuters'),
  ('Associated Press', 'associatedpress'),
  ('The New York Times', 'newyorktimes'),
  ('The Washington Post', 'washingtonpost'),
  ('The Wall Street Journal', 'wsj')
on conflict (normalized) do nothing;
