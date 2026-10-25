-- ============================================================================
-- STFU — phase 3: conversations under memories
-- Comments can now hang off a memory instead of a post.
-- Safe to re-run.
-- ============================================================================

alter table public.comments alter column post_id drop not null;
alter table public.comments
  add column if not exists memory_id uuid references public.memories (id) on delete cascade;

alter table public.comments drop constraint if exists comments_parent_check;
alter table public.comments
  add constraint comments_parent_check check (num_nonnulls(post_id, memory_id) = 1);

create index if not exists comments_memory_idx on public.comments (memory_id, created_at);

-- The bell needs to know which memory a comment belongs to so it can link there.
alter table public.notifications
  add column if not exists memory_id uuid references public.memories (id) on delete cascade;

create or replace function public.notify_new_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.memory_id is not null then
    insert into public.notifications (user_id, actor_id, kind, entity_id, memory_id, body)
    select distinct t.user_id, new.author_id, 'comment', new.id, new.memory_id,
           left(coalesce(new.body, ''), 160)
      from (
        select m.created_by as user_id from public.memories m where m.id = new.memory_id
        union
        select c.author_id from public.comments c where c.id = new.parent_id
      ) t
     where t.user_id <> new.author_id;
    return new;
  end if;

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
