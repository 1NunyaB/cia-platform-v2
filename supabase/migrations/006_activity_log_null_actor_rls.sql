-- Allow unattributed activity (investigation tool): actor_id may be null when there is no profile FK target.
-- Aligns with 003_mvp_no_auth_fks.sql (drop FK, nullable actor_id, actor_label).

ALTER TABLE public.activity_log DROP CONSTRAINT IF EXISTS activity_log_actor_id_fkey;
ALTER TABLE public.activity_log ALTER COLUMN actor_id DROP NOT NULL;

DROP POLICY IF EXISTS "Activity insert" ON public.activity_log;
CREATE POLICY "Activity insert" ON public.activity_log FOR INSERT WITH CHECK (
  (actor_id IS NULL OR actor_id = auth.uid())
  AND (
    public.is_case_member(case_id, auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.cases c
      WHERE c.id = case_id AND c.visibility = 'public'
    )
  )
);
