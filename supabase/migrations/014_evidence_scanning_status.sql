-- Extended evidence processing lifecycle: scan gate + explicit acceptance before extraction.

do $$ begin
  alter type public.evidence_processing_status add value 'scanning';
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter type public.evidence_processing_status add value 'accepted';
exception
  when duplicate_object then null;
end $$;

do $$ begin
  alter type public.evidence_processing_status add value 'blocked';
exception
  when duplicate_object then null;
end $$;

comment on type public.evidence_processing_status is
  'Pipeline: validation + AV (in app) → accepted → extracting → complete; scanning/blocked reserved for UI/async; blocked may flag rejected items if stored.';
