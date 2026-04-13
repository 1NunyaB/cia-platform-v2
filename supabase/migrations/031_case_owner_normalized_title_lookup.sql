-- Prevent duplicate case creation per owner: lookup by whitespace-normalized, lowercased title.
-- Matches application logic: trim, lowercase, collapse internal whitespace (see services/case-service.ts normTitle).

create or replace function public.find_case_for_owner_by_normalized_title(
  p_user_id uuid,
  p_normalized text
)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select c.id
  from public.cases c
  where c.created_by = p_user_id
    and lower(trim(both from regexp_replace(trim(both from c.title), '\s+', ' ', 'g'))) = p_normalized
  order by c.created_at asc
  limit 1;
$$;

comment on function public.find_case_for_owner_by_normalized_title(uuid, text) is
  'Returns the earliest-created case id for this creator with the same normalized title; POST /api/cases uses this before insert.';

grant execute on function public.find_case_for_owner_by_normalized_title(uuid, text) to authenticated;
grant execute on function public.find_case_for_owner_by_normalized_title(uuid, text) to service_role;
