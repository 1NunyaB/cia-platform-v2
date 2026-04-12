-- Multiple parallel timelines per case (kind + per-event metadata for provenance and reasoning).

do $$ begin
  create type public.timeline_kind as enum (
    'witness',
    'subject_actor',
    'official',
    'evidence',
    'reconstructed'
  );
exception
  when duplicate_object then null;
end $$;

alter table public.timeline_events
  add column if not exists timeline_kind public.timeline_kind not null default 'evidence';

comment on column public.timeline_events.timeline_kind is
  'Parallel timeline lane: witness, subject/actor, official, evidence-derived, or synthesized reconstructed.';

alter table public.timeline_events
  add column if not exists source_label text;

comment on column public.timeline_events.source_label is
  'Who or what documented this event (e.g. witness name, agency, file id).';

alter table public.timeline_events
  add column if not exists event_classification text;

comment on column public.timeline_events.event_classification is
  'Per-event analytical classification (distinct from case finding classification when needed).';

alter table public.timeline_events
  add column if not exists event_reasoning text;

alter table public.timeline_events
  add column if not exists event_limitations text;

create index if not exists idx_timeline_events_case_kind on public.timeline_events (case_id, timeline_kind);
