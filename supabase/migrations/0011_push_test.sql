-- ============================================================================
-- STFU — a push self-test: the member asks the circle's own pipeline for one
-- notification on their own devices, so "does it really arrive?" can be
-- answered on the phone itself.
-- ============================================================================

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('comment', 'reaction', 'post', 'event', 'memory', 'reminder', 'mention', 'test'));

-- Inserts only for the caller, so nobody can buzz someone else's phone.
create or replace function public.push_self_test()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  devices integer;
begin
  if not public.is_approved() then
    raise exception 'Only approved members can test notifications';
  end if;

  select count(*) into devices
    from public.push_subscriptions
   where user_id = auth.uid();

  insert into public.notifications (user_id, actor_id, kind, entity_id, post_id, body)
  values (
    auth.uid(),
    null,
    'test',
    null,
    null,
    'Test notification — if your phone buzzed, push is working.'
  );

  return devices;
end;
$$;

revoke all on function public.push_self_test() from anon;
grant execute on function public.push_self_test() to authenticated;
