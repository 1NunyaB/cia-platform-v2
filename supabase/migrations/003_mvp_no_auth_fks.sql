-- MVP no-auth: relax profile/auth foreign keys so rows can exist without auth.users / profiles.
-- Apply after 001_initial_schema.sql. Server uses SUPABASE_SERVICE_ROLE_KEY (bypasses RLS).

-- Cases: optional creator
ALTER TABLE public.cases DROP CONSTRAINT IF EXISTS cases_created_by_fkey;
ALTER TABLE public.cases ALTER COLUMN created_by DROP NOT NULL;

-- Notes / comments: optional profile link + display label for anonymous/local analyst
ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_author_id_fkey;
ALTER TABLE public.notes ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS author_label text;

ALTER TABLE public.comments DROP CONSTRAINT IF EXISTS comments_author_id_fkey;
ALTER TABLE public.comments ALTER COLUMN author_id DROP NOT NULL;
ALTER TABLE public.comments ADD COLUMN IF NOT EXISTS author_label text;

-- Activity / contributions: optional actor
ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_actor_id_fkey;
ALTER TABLE public.activity_log ALTER COLUMN actor_id DROP NOT NULL;
ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS actor_label text;

ALTER TABLE public.contributions DROP CONSTRAINT IF EXISTS contributions_user_id_fkey;
ALTER TABLE public.contributions ALTER COLUMN user_id DROP NOT NULL;

-- Evidence: optional uploader profile
ALTER TABLE public.evidence_files DROP CONSTRAINT IF EXISTS evidence_files_uploaded_by_fkey;
ALTER TABLE public.evidence_files ALTER COLUMN uploaded_by DROP NOT NULL;
ALTER TABLE public.evidence_files ADD COLUMN IF NOT EXISTS uploaded_by_label text;
