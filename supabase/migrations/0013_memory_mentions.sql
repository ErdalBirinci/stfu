-- ============================================================================
-- STFU — memories can pull people in too.
--
-- Mentions worked on posts and replies because notify_mentions() reads
-- new.body / new.author_id. A memory stores its words in `description` and its
-- author in `created_by`, so the same trigger never matched it. This is the
-- memory-shaped twin, fired on insert, that writes the same `mention`
-- notifications the bell and the push pipeline already understand.
-- ============================================================================

create or replace function public.notify_memory_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  text_body text;
  hit record;
begin
  text_body := lower(coalesce(new.title, '') || ' ' || coalesce(new.description, ''));
  if position('@' in text_body) = 0 then
    return new;
  end if;

  for hit in
    select p.id
      from public.profiles p
     where p.status = 'approved'
       and p.id <> new.created_by
       and position(lower('@' || p.display_name) in text_body) > 0
  loop
    insert into public.notifications (user_id, actor_id, kind, entity_id, memory_id, body)
    values (
      hit.id,
      new.created_by,
      'mention',
      new.id,
      new.id,
      left(coalesce(new.description, new.title, ''), 160)
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists memories_notify_mentions on public.memories;
create trigger memories_notify_mentions
  after insert on public.memories
  for each row execute function public.notify_memory_mentions();
