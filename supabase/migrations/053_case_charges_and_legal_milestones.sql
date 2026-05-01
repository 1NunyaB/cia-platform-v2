-- Legal case progress: charges (replaces known_weapon), indictment / conviction / sentence milestones.
-- Align case row updates with collaboration write access so contributors can fill in metadata later.

alter table public.cases
  rename column known_weapon to charges;

comment on column public.cases.charges is
  'Formal or alleged charges; free text (may be multiple lines in the UI).';

alter table public.cases
  add column if not exists indictment_month_year text;

alter table public.cases
  add column if not exists conviction_month_year text;

alter table public.cases
  add column if not exists sentence text;

comment on column public.cases.indictment_month_year is
  'Indictment month/year when known; stored as MM/YYYY text (e.g. 10/2021).';

comment on column public.cases.conviction_month_year is
  'Conviction month/year when known; stored as MM/YYYY text (e.g. 10/2021).';

comment on column public.cases.sentence is
  'Sentence or disposition when a conviction exists; optional free text.';

drop policy if exists "Cases update" on public.cases;
create policy "Cases update" on public.cases for update using (
  public.can_write_case(id, auth.uid())
);
