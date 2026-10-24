-- Posts no longer need a title: a photo, a one-liner or a bare link drops in fine.
-- Run in the Supabase SQL editor (safe to re-run).

alter table public.posts drop constraint if exists posts_title_check;
alter table public.posts alter column title set default '';
alter table public.posts
  add constraint posts_title_check check (char_length(title) <= 140);
