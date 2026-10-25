-- ============================================================================
-- STFU — pin one post to the top of the timeline (and of its label)
-- Safe to re-run: every object is created only when missing.
-- ============================================================================

alter table public.posts
  add column if not exists pinned_at timestamptz;

create index if not exists posts_pinned_idx on public.posts (pinned_at desc nulls last);

-- Same rule as labels: the circle's admin decides what sits at the top.
create or replace function public.protect_post_pin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.pinned_at is distinct from old.pinned_at and not public.is_admin() then
    raise exception 'Only an admin can pin a post';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_protect_pin on public.posts;
create trigger posts_protect_pin
  before update on public.posts
  for each row execute function public.protect_post_pin();

-- Pinning a post also clears any previous pin inside the same label, so a
-- label always has at most one post sitting at the top.
create or replace function public.pin_post(target uuid, pinned boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_category uuid;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can pin a post';
  end if;

  select category_id into target_category from public.posts where id = target;
  if not found then
    raise exception 'That post no longer exists';
  end if;

  if pinned then
    update public.posts
       set pinned_at = null
     where id <> target
       and pinned_at is not null
       and category_id is not distinct from target_category;

    update public.posts set pinned_at = now() where id = target;
  else
    update public.posts set pinned_at = null where id = target;
  end if;
end;
$$;

revoke all on function public.pin_post(uuid, boolean) from anon;
grant execute on function public.pin_post(uuid, boolean) to authenticated;
