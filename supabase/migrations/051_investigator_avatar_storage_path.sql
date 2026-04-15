-- Allow avatars under investigators/avatars/<user-id>/... in addition to legacy <user-id>/...

create or replace function public.avatars_object_owned_by_me(object_name text)
returns boolean
language sql
stable
as $$
  select
    split_part(object_name, '/', 1) = auth.uid()::text
    or (
      split_part(object_name, '/', 1) = 'investigators'
      and split_part(object_name, '/', 2) = 'avatars'
      and split_part(object_name, '/', 3) = auth.uid()::text
    );
$$;

comment on function public.avatars_object_owned_by_me(text) is
  'True when storage object name is legacy {uid}/... or investigators/avatars/{uid}/... for avatars bucket.';

drop policy if exists "avatars insert own folder" on storage.objects;
create policy "avatars insert own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and public.avatars_object_owned_by_me(name)
  );

drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and public.avatars_object_owned_by_me(name)
  )
  with check (
    bucket_id = 'avatars'
    and public.avatars_object_owned_by_me(name)
  );

drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars delete own"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and public.avatars_object_owned_by_me(name)
  );
