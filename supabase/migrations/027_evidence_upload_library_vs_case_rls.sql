-- Clarify evidence upload RLS: library inserts require only the authenticated uploader;
-- case-scoped inserts additionally require write access to the case.
-- Re-assert next_evidence_file_sequence so NULL case_id never calls can_write_case (repairs drift from older migrations).

-- ---------------------------------------------------------------------------
-- Sequence RPC: library (NULL case) uses user_evidence_counters only
-- ---------------------------------------------------------------------------
create or replace function public.next_evidence_file_sequence(p_case_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v integer;
  uid uuid;
begin
  uid := auth.uid();
  if uid is null then
    raise exception 'not authenticated';
  end if;

  if p_case_id is null then
    insert into public.user_evidence_counters (user_id, last_seq)
    values (uid, 1)
    on conflict (user_id) do update
    set last_seq = public.user_evidence_counters.last_seq + 1
    returning last_seq into v;
    return v;
  end if;

  if not public.can_write_case(p_case_id, uid) then
    raise exception 'forbidden';
  end if;

  insert into public.case_evidence_counters (case_id, last_seq)
  values (p_case_id, 1)
  on conflict (case_id) do update
  set last_seq = public.case_evidence_counters.last_seq + 1
  returning last_seq into v;

  return v;
end;
$$;

-- ---------------------------------------------------------------------------
-- Evidence insert: uploader must be the current user; case optional
-- ---------------------------------------------------------------------------
drop policy if exists "Evidence insert" on public.evidence_files;
create policy "Evidence insert" on public.evidence_files for insert with check (
  uploaded_by = auth.uid()
  and (
    case_id is null
    or public.can_write_case(case_id, auth.uid())
  )
);
