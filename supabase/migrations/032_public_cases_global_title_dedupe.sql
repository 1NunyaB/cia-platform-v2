-- Shared public investigations: all cases visible in directory; global normalized-title dedupe on create.

update public.cases
set visibility = 'public'::case_visibility
where visibility is distinct from 'public';

-- Global exact match (any creator) — same normalized title as application `normalizeCaseTitle`.
create or replace function public.find_case_by_normalized_title(p_normalized text)
returns uuid
language sql
stable
security invoker
set search_path = public
as $$
  select c.id
  from public.cases c
  where lower(trim(both from regexp_replace(trim(both from c.title), '\s+', ' ', 'g'))) = p_normalized
  order by c.created_at asc
  limit 1;
$$;

comment on function public.find_case_by_normalized_title(text) is
  'Returns the earliest case with this normalized title (shared investigations; POST /api/cases dedupes before insert).';

grant execute on function public.find_case_by_normalized_title(text) to authenticated;
grant execute on function public.find_case_by_normalized_title(text) to service_role;

drop function if exists public.find_case_for_owner_by_normalized_title(uuid, text);
