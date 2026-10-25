-- ============================================================================
-- STFU — claiming a device.
--
-- A browser keeps its push subscription across sign-outs, so the same phone
-- could still be attached to whoever enabled notifications first. Writing the
-- row directly from the client cannot move it (row level security only lets you
-- touch your own rows), and a plain upsert on the endpoint then fails, which is
-- how a phone ends up "on" while the database thinks it has no device.
--
-- This definer function makes the signed-in member the owner of the device they
-- are holding, and it is the only write path the app uses.
-- ============================================================================

create or replace function public.claim_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed uuid;
begin
  if auth.uid() is null or not public.is_approved() then
    raise exception 'Only approved members can register a device';
  end if;

  if coalesce(p_endpoint, '') = '' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Incomplete subscription';
  end if;

  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent, failed_at)
  values (
    auth.uid(),
    p_endpoint,
    p_p256dh,
    p_auth,
    left(coalesce(p_user_agent, ''), 200),
    null
  )
  on conflict (endpoint) do update
    set user_id = auth.uid(),
        p256dh = excluded.p256dh,
        auth = excluded.auth,
        user_agent = excluded.user_agent,
        failed_at = null
  returning id into claimed;

  return claimed;
end;
$$;

revoke all on function public.claim_push_subscription(text, text, text, text) from anon;
grant execute on function public.claim_push_subscription(text, text, text, text) to authenticated;
