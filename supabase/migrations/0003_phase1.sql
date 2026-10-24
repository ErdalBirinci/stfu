-- ============================================================================
-- STFU — phase 1: reactions, notifications and circle search
-- Safe to re-run: every object is created only when missing.
-- ============================================================================

-- --------------------------------------------------------------- reactions --
create table if not exists public.post_reactions (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  emoji      text not null default 'heart' check (emoji in ('heart', 'shush', 'laugh', 'fire')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_reactions_post_idx on public.post_reactions (post_id);

alter table public.post_reactions enable row level security;

drop policy if exists reactions_select on public.post_reactions;
create policy reactions_select on public.post_reactions
  for select to authenticated using (public.is_approved());

drop policy if exists reactions_insert on public.post_reactions;
create policy reactions_insert on public.post_reactions
  for insert to authenticated with check (public.is_approved() and user_id = auth.uid());

drop policy if exists reactions_update on public.post_reactions;
create policy reactions_update on public.post_reactions
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists reactions_delete on public.post_reactions;
create policy reactions_delete on public.post_reactions
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.post_reactions to authenticated;
revoke all on public.post_reactions from anon;

-- ----------------------------------------------------------- notifications --
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  actor_id   uuid references public.profiles (id) on delete set null,
  kind       text not null check (kind in ('comment', 'reaction', 'post', 'event', 'memory')),
  entity_id  uuid,
  post_id    uuid references public.posts (id) on delete cascade,
  body       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
alter table public.notifications replica identity full;

drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (user_id = auth.uid() and public.is_approved());

drop policy if exists notifications_update on public.notifications;
create policy notifications_update on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_delete on public.notifications;
create policy notifications_delete on public.notifications
  for delete to authenticated using (user_id = auth.uid());

-- Rows are only ever written by the triggers below, never by the client.
grant select on public.notifications to authenticated;
grant update (read_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;
revoke all on public.notifications from anon;

-- ------------------------------------------------------- notification hooks --
create or replace function public.notify_new_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, kind, entity_id, post_id, body)
  select p.id, new.author_id, 'post', new.id, new.id,
         coalesce(nullif(new.title, ''), left(coalesce(new.body, ''), 140))
    from public.profiles p
   where p.status = 'approved' and p.id <> new.author_id;
  return new;
end;
$$;

drop trigger if exists posts_notify on public.posts;
create trigger posts_notify
  after insert on public.posts
  for each row execute function public.notify_new_post();

create or replace function public.notify_new_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, kind, entity_id, post_id, body)
  select distinct t.user_id, new.author_id, 'comment', new.id, new.post_id,
         left(coalesce(new.body, ''), 160)
    from (
      select p.author_id as user_id from public.posts p where p.id = new.post_id
      union
      select c.author_id from public.comments c where c.id = new.parent_id
    ) t
   where t.user_id <> new.author_id;
  return new;
end;
$$;

drop trigger if exists comments_notify on public.comments;
create trigger comments_notify
  after insert on public.comments
  for each row execute function public.notify_new_comment();

create or replace function public.notify_new_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, kind, entity_id, post_id, body)
  select p.author_id, new.user_id, 'reaction', new.post_id, new.post_id, new.emoji
    from public.posts p
   where p.id = new.post_id and p.author_id <> new.user_id;
  return new;
end;
$$;

drop trigger if exists reactions_notify on public.post_reactions;
create trigger reactions_notify
  after insert on public.post_reactions
  for each row execute function public.notify_new_reaction();

create or replace function public.notify_new_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, kind, entity_id, body)
  select p.id, new.created_by, 'event', new.id, new.title
    from public.profiles p
   where p.status = 'approved' and p.id <> new.created_by;
  return new;
end;
$$;

drop trigger if exists events_notify on public.events;
create trigger events_notify
  after insert on public.events
  for each row execute function public.notify_new_event();

create or replace function public.notify_new_memory()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, kind, entity_id, body)
  select p.id, new.created_by, 'memory', new.id, new.title
    from public.profiles p
   where p.status = 'approved' and p.id <> new.created_by;
  return new;
end;
$$;

drop trigger if exists memories_notify on public.memories;
create trigger memories_notify
  after insert on public.memories
  for each row execute function public.notify_new_memory();

-- ---------------------------------------------------------------- realtime --
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;

-- ------------------------------------------------------------------ search --
create or replace function public.search_circle(term text)
returns table (
  kind text,
  id uuid,
  post_id uuid,
  title text,
  snippet text,
  created_at timestamptz,
  author_name text
)
language sql
stable
set search_path = public
as $$
  with q as (
    select '%' || replace(replace(replace(trim(coalesce(term, '')), '%', ''), ',', ' '), '_', ' ') || '%' as pattern
  )
  select 'post'::text, p.id, p.id, p.title, left(coalesce(p.body, ''), 180), p.created_at, pr.display_name
    from public.posts p
    join public.profiles pr on pr.id = p.author_id, q
   where public.is_approved() and (p.title ilike q.pattern or p.body ilike q.pattern)
  union all
  select 'memory', m.id, null, m.title, left(coalesce(m.description, ''), 180), m.created_at, pr.display_name
    from public.memories m
    join public.profiles pr on pr.id = m.created_by, q
   where public.is_approved() and (m.title ilike q.pattern or coalesce(m.description, '') ilike q.pattern)
  union all
  select 'event', e.id, null, e.title, left(coalesce(e.description, ''), 180), e.starts_at, pr.display_name
    from public.events e
    join public.profiles pr on pr.id = e.created_by, q
   where public.is_approved() and (e.title ilike q.pattern or coalesce(e.description, '') ilike q.pattern)
  union all
  select 'comment', c.id, c.post_id, coalesce(p.title, 'Reply'),
         left(coalesce(c.body, ''), 180), c.created_at, pr.display_name
    from public.comments c
    join public.posts p on p.id = c.post_id
    join public.profiles pr on pr.id = c.author_id, q
   where public.is_approved() and c.body ilike q.pattern
  order by created_at desc
  limit 40;
$$;

grant execute on function public.search_circle(text) to authenticated;
revoke execute on function public.search_circle(text) from anon;
