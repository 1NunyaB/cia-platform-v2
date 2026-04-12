-- Optional structured audit trail for contextual time anchors (holidays, public events, media, cross-evidence).

alter table public.timeline_events
  add column if not exists contextual_time_inference jsonb;

comment on column public.timeline_events.contextual_time_inference is
  'Structured explanation of timing inferred from holidays, known public/media events, or cross-evidence alignment (not necessarily verbatim in the source).';
