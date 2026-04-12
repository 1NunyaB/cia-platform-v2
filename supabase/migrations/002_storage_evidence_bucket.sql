-- Run after creating bucket `evidence` in Supabase Dashboard → Storage (private bucket).
-- Adjust policies for production (restrict by case membership via storage path + SQL or Edge Function).

insert into storage.buckets (id, name, public)
values ('evidence', 'evidence', false)
on conflict (id) do nothing;

-- Authenticated users can manage objects in evidence bucket (MVP).
-- TODO: tighten with path-based checks or signed URLs via Edge Function.
create policy "evidence authenticated read"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'evidence');

create policy "evidence authenticated insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'evidence');

create policy "evidence authenticated update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'evidence');

create policy "evidence authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'evidence');
