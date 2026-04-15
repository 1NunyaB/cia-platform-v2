-- Richer routing fields + Realtime for user_notifications

alter table public.user_notifications
  add column if not exists actor_user_id uuid references public.profiles (id) on delete set null,
  add column if not exists case_id uuid references public.cases (id) on delete cascade,
  add column if not exists link_url text;

comment on column public.user_notifications.actor_user_id is 'User who triggered the event (when applicable).';
comment on column public.user_notifications.case_id is 'Related investigation, for deep links.';
comment on column public.user_notifications.link_url is 'Optional explicit navigation target.';

create index if not exists idx_user_notifications_user_created_desc
  on public.user_notifications (user_id, created_at desc);

create index if not exists idx_user_notifications_case_id
  on public.user_notifications (case_id)
  where case_id is not null;

-- Realtime: WAL + RLS so clients only receive their own inserts
alter table public.user_notifications replica identity full;

-- Enable Realtime (safe to run once; if already added, apply via Supabase Dashboard → Realtime)
alter publication supabase_realtime add table public.user_notifications;
