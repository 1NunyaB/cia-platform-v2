-- Link evidence rows directly to a specific incident entry within a case.
alter table public.evidence_files
  add column if not exists incident_entry_id text;

alter table public.evidence_files
  add constraint evidence_files_incident_entry_id_len_chk
  check (incident_entry_id is null or char_length(incident_entry_id) <= 80);

create index if not exists idx_evidence_files_case_incident_entry
  on public.evidence_files (case_id, incident_entry_id)
  where incident_entry_id is not null;

comment on column public.evidence_files.incident_entry_id is
  'Incident entry id from cases.incident_entries[].id for incident-level evidence linkage.';
