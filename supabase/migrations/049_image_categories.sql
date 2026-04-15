-- Image analysis hub: category metadata + evidence_files.image_category + storage under images/{name}/...

create table if not exists public.image_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  label text not null
);

comment on table public.image_categories is
  'Display labels for image-analysis folder names; names match evidence_files.image_category and storage paths.';

alter table public.image_categories enable row level security;

create policy "image_categories select authenticated"
  on public.image_categories for select
  to authenticated
  using (true);

insert into public.image_categories (name, label) values
  ('location', 'Location pictures'),
  ('furnishings', 'Furnishings'),
  ('misc', 'Miscellaneous objects'),
  ('transport', 'Transportation'),
  ('people', 'People')
on conflict (name) do update set label = excluded.label;

alter table public.evidence_files
  add column if not exists image_category text references public.image_categories (name) on delete set null;

create index if not exists idx_evidence_files_image_category
  on public.evidence_files (image_category)
  where image_category is not null;

comment on column public.evidence_files.image_category is
  'When set, file is stored under evidence bucket images/{name}/... and listed in Image Analysis hub.';
