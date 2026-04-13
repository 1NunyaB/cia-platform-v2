-- Evidence uploads must not fail when auth.users exists but public.profiles has no row yet.
-- uploaded_by stores the authenticated subject id (same uuid as auth.users.id / profiles.id when present);
-- it is not a hard foreign key to profiles.

-- ---------------------------------------------------------------------------
-- user_evidence_counters: sequence for library uploads (next_evidence_file_sequence)
-- ---------------------------------------------------------------------------
alter table public.user_evidence_counters
  drop constraint if exists user_evidence_counters_user_id_fkey;

comment on column public.user_evidence_counters.user_id is
  'Auth user id (typically matches auth.users.id and profiles.id when a profile row exists). No FK to profiles so library sequencing works before profile creation.';

-- ---------------------------------------------------------------------------
-- evidence_files: reinforce optional uploader (003); ensure no profile FK remains
-- ---------------------------------------------------------------------------
alter table public.evidence_files
  drop constraint if exists evidence_files_uploaded_by_fkey;

comment on column public.evidence_files.uploaded_by is
  'Authenticated uploader subject id when known (auth.users.id); optional FK removed so uploads are not blocked by missing profiles row. Guest uploads use guest_session_id instead.';

-- ---------------------------------------------------------------------------
-- evidence_upload_audit: audit row must accept auth uid without profiles FK
-- ---------------------------------------------------------------------------
alter table public.evidence_upload_audit
  drop constraint if exists evidence_upload_audit_uploaded_by_fkey;

comment on column public.evidence_upload_audit.uploaded_by is
  'Uploader subject id when recorded for signed-in uploads; no FK to profiles. Pair with uploader_ip / guest_session_id for traceability.';
