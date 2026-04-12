-- Case creation no longer inserts case_members (avoids profiles FK). Align RLS so the
-- case creator (created_by) has the same practical access as an owner member row.

create or replace function public.is_case_member(p_case uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.case_members m
    where m.case_id = p_case and m.user_id = p_user
  )
  or exists (
    select 1 from public.cases c
    where c.id = p_case and c.created_by is not null and c.created_by = p_user
  );
$$;

create or replace function public.can_write_case(p_case uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.case_members m
    where m.case_id = p_case and m.user_id = p_user
      and m.role in ('owner', 'admin', 'contributor')
  )
  or exists (
    select 1 from public.cases c
    where c.id = p_case and c.created_by is not null and c.created_by = p_user
  );
$$;

drop policy if exists "Cases update" on public.cases;
create policy "Cases update" on public.cases for update using (
  created_by = auth.uid()
  or exists (
    select 1 from public.case_members m
    where m.case_id = cases.id and m.user_id = auth.uid()
      and m.role in ('owner', 'admin')
  )
);

drop policy if exists "Cases delete" on public.cases;
create policy "Cases delete" on public.cases for delete using (
  created_by = auth.uid()
  or exists (
    select 1 from public.case_members m
    where m.case_id = cases.id and m.user_id = auth.uid() and m.role = 'owner'
  )
);
