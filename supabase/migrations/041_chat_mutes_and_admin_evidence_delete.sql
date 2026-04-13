-- Admin moderation: dashboard chat mutes (30 min windows) and admin-only evidence delete policy.

create table if not exists public.dashboard_chat_mutes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  muted_until timestamptz not null,
  reason text,
  muted_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_dashboard_chat_mutes_user_until
  on public.dashboard_chat_mutes (user_id, muted_until desc);

alter table public.dashboard_chat_mutes enable row level security;

drop policy if exists "dashboard_chat_mutes select own_or_admin" on public.dashboard_chat_mutes;
create policy "dashboard_chat_mutes select own_or_admin" on public.dashboard_chat_mutes
for select using (
  auth.uid() = user_id
  or lower(coalesce(auth.jwt() ->> 'email', '')) = 'kesmall7712@gmail.com'
);

drop policy if exists "dashboard_chat_mutes insert admin" on public.dashboard_chat_mutes;
create policy "dashboard_chat_mutes insert admin" on public.dashboard_chat_mutes
for insert with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'kesmall7712@gmail.com'
);

drop policy if exists "dashboard_chat_mutes update admin" on public.dashboard_chat_mutes;
create policy "dashboard_chat_mutes update admin" on public.dashboard_chat_mutes
for update using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'kesmall7712@gmail.com'
) with check (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'kesmall7712@gmail.com'
);

drop policy if exists "evidence_files delete admin only" on public.evidence_files;
create policy "evidence_files delete admin only" on public.evidence_files
for delete using (
  lower(coalesce(auth.jwt() ->> 'email', '')) = 'kesmall7712@gmail.com'
);
