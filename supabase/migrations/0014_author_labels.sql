-- ============================================================================
-- STFU — labels picked by the author
-- Members now choose a label while writing a post. Dobby keeps the wider
-- powers: relabelling anything, renaming/deleting labels, pinning and hiding.
-- Safe to re-run: only the trigger function is replaced.
-- ============================================================================

create or replace function public.protect_post_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- The author may file their own post; the admin may file any post. Anything
  -- else is a member trying to relabel someone else's words.
  if new.category_id is distinct from old.category_id
     and not public.is_admin()
     and new.author_id is distinct from auth.uid() then
    raise exception 'You can only label your own posts';
  end if;
  return new;
end;
$$;

-- The trigger from 0006_phase3 already calls this function by name, so it picks
-- up the new rule without being recreated.
drop trigger if exists posts_protect_category on public.posts;
create trigger posts_protect_category
  before update on public.posts
  for each row execute function public.protect_post_category();
