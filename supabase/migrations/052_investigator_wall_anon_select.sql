-- Let anonymous sessions read opted-in investigator rows so the Investigators wall can load without signing in.

drop policy if exists "Profiles select investigator wall anon" on public.profiles;
create policy "Profiles select investigator wall anon"
  on public.profiles
  for select
  to anon
  using (
    investigator_opt_in = true
    and coalesce(trim(investigator_alias), '') != ''
  );
