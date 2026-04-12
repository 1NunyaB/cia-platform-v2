-- Timeline placement tiers (strict classification alignment enforced in application code).

do $$ begin
  create type public.timeline_tier as enum ('t1_confirmed', 't2_supported', 't3_leads');
exception
  when duplicate_object then null;
end $$;

alter table public.timeline_events
  add column if not exists timeline_tier public.timeline_tier not null default 't3_leads';

comment on column public.timeline_events.timeline_tier is
  'T1 = confirmed time (explicit date + multi-source + strong classification); T2 = supported; T3 = leads / weak timing.';
