-- Repair migration: ensure library upload sequencing table exists in environments
-- that have `next_evidence_file_sequence` but are missing `user_evidence_counters`.
-- Library uploads (`case_id is null`) call this table via the RPC.

create table if not exists public.user_evidence_counters (
  user_id uuid primary key,
  last_seq integer not null default 0
);

-- Old deployments may still carry a profiles FK from early library migrations.
alter table public.user_evidence_counters
  drop constraint if exists user_evidence_counters_user_id_fkey;

alter table public.user_evidence_counters enable row level security;

drop policy if exists "user_evidence_counters select own" on public.user_evidence_counters;
create policy "user_evidence_counters select own" on public.user_evidence_counters
  for select using (user_id = auth.uid());

drop policy if exists "user_evidence_counters write own" on public.user_evidence_counters;
create policy "user_evidence_counters write own" on public.user_evidence_counters
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

comment on table public.user_evidence_counters is
  'Per-user sequence counter for evidence library uploads (case_id is null). Used by next_evidence_file_sequence.';

