-- Allow invitees to accept via RPC (RLS on case_invites only allows case writers to select rows).

create or replace function public.accept_case_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.case_invites%rowtype;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select u.email into v_email
  from auth.users u
  where u.id = auth.uid();

  if v_email is null or btrim(v_email) = '' then
    raise exception 'account has no email';
  end if;

  select * into v_inv
  from public.case_invites
  where token = p_token
    and accepted_at is null
    and expires_at > now();

  if not found then
    raise exception 'invalid or expired invite';
  end if;

  if lower(btrim(v_inv.email)) <> lower(btrim(v_email)) then
    raise exception 'sign in with the invited email address';
  end if;

  insert into public.case_members (case_id, user_id, role, invited_by)
  values (v_inv.case_id, auth.uid(), v_inv.role, v_inv.invited_by)
  on conflict (case_id, user_id) do update
    set role = excluded.role;

  update public.case_invites
  set accepted_at = now()
  where id = v_inv.id;

  return jsonb_build_object('case_id', v_inv.case_id);
end;
$$;

revoke all on function public.accept_case_invite(text) from public;
grant execute on function public.accept_case_invite(text) to authenticated;

comment on function public.accept_case_invite(text) is
  'Invitee accepts: verifies auth email matches invite, inserts case_members, marks invite accepted.';
