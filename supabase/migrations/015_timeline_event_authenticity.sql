-- Per-event provenance label (slug), aligned with ai_analyses.structured.authenticity_label
alter table public.timeline_events
  add column if not exists authenticity_label text;

comment on column public.timeline_events.authenticity_label is
  'Evidence authenticity slug: verified_by_source | strongly_corroborated | likely_authentic | unverified | inconsistent | potentially_manipulated';
