-- Restrict destructive deletes to one authenticated admin account.
-- Admin identity is enforced by JWT email claim, not display alias.

drop policy if exists "sticky_notes delete" on public.evidence_sticky_notes;
create policy "sticky_notes delete" on public.evidence_sticky_notes
  for delete using (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'kesmall7712@gmail.com'
  );

drop policy if exists "sticky_replies delete" on public.evidence_sticky_note_replies;
create policy "sticky_replies delete" on public.evidence_sticky_note_replies
  for delete using (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'kesmall7712@gmail.com'
  );

drop policy if exists "Cases delete" on public.cases;
create policy "Cases delete" on public.cases
  for delete using (
    lower(coalesce(auth.jwt() ->> 'email', '')) = 'kesmall7712@gmail.com'
  );

