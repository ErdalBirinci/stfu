-- ============================================================================
-- STFU — phase 4: mentions, polls, capsules, event albums, weekly prompt,
-- hidden posts, blur previews, yearly recap and archive export.
-- Safe to re-run: every object is created only when missing.
-- ============================================================================

-- ------------------------------------------------------------ hidden posts --
alter table public.posts add column if not exists hidden_at timestamptz;

create or replace function public.protect_post_hidden()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.hidden_at is distinct from old.hidden_at and not public.is_admin() then
    raise exception 'Only an admin can hide a post';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_protect_hidden on public.posts;
create trigger posts_protect_hidden
  before update on public.posts
  for each row execute function public.protect_post_hidden();

-- A hidden post leaves everyone else's timeline but stays visible to admins.
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts
  for select to authenticated
  using (public.is_approved() and (hidden_at is null or public.is_admin()));

create or replace function public.hide_post(target uuid, hidden boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Only an admin can hide a post';
  end if;
  update public.posts
     set hidden_at = case when hidden then now() else null end
   where id = target;
end;
$$;

revoke all on function public.hide_post(uuid, boolean) from anon;
grant execute on function public.hide_post(uuid, boolean) to authenticated;

-- Moving several posts into one label at once (the admin filing list).
create or replace function public.bulk_label(targets uuid[], category uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed integer;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can label posts';
  end if;
  update public.posts
     set category_id = category
   where id = any (targets);
  get diagnostics changed = row_count;
  return changed;
end;
$$;

revoke all on function public.bulk_label(uuid[], uuid) from anon;
grant execute on function public.bulk_label(uuid[], uuid) to authenticated;

-- ------------------------------------------------------------------- polls --
create table if not exists public.post_poll_options (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  label      text not null check (char_length(label) between 1 and 80),
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists post_poll_options_post_idx
  on public.post_poll_options (post_id, position);

create table if not exists public.post_poll_votes (
  post_id    uuid not null references public.posts (id) on delete cascade,
  option_id  uuid not null references public.post_poll_options (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists post_poll_votes_option_idx on public.post_poll_votes (option_id);

alter table public.post_poll_options enable row level security;
alter table public.post_poll_votes enable row level security;

drop policy if exists poll_options_select on public.post_poll_options;
create policy poll_options_select on public.post_poll_options
  for select to authenticated using (public.is_approved());

drop policy if exists poll_options_insert on public.post_poll_options;
create policy poll_options_insert on public.post_poll_options
  for insert to authenticated
  with check (
    public.is_approved()
    and exists (
      select 1 from public.posts p
       where p.id = post_id and p.author_id = auth.uid() and p.hidden_at is null
    )
  );

drop policy if exists poll_options_delete on public.post_poll_options;
create policy poll_options_delete on public.post_poll_options
  for delete to authenticated
  using (public.is_admin() or exists (
    select 1 from public.posts p where p.id = post_id and p.author_id = auth.uid()
  ));

drop policy if exists poll_votes_select on public.post_poll_votes;
create policy poll_votes_select on public.post_poll_votes
  for select to authenticated using (public.is_approved());

drop policy if exists poll_votes_insert on public.post_poll_votes;
create policy poll_votes_insert on public.post_poll_votes
  for insert to authenticated with check (public.is_approved() and user_id = auth.uid());

drop policy if exists poll_votes_update on public.post_poll_votes;
create policy poll_votes_update on public.post_poll_votes
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists poll_votes_delete on public.post_poll_votes;
create policy poll_votes_delete on public.post_poll_votes
  for delete to authenticated using (user_id = auth.uid());

grant select, insert, update, delete on public.post_poll_options to authenticated;
grant select, insert, update, delete on public.post_poll_votes to authenticated;
revoke all on public.post_poll_options from anon;
revoke all on public.post_poll_votes from anon;

-- --------------------------------------------------------- blur previews ---
alter table public.media add column if not exists blur_data text;

-- --------------------------------------------------------- event covers -----
alter table public.events add column if not exists cover_path text;

-- ---------------------------------------------- capsules and event albums ---
alter table public.memories add column if not exists publish_at timestamptz;
alter table public.memories
  add column if not exists event_id uuid references public.events (id) on delete set null;

create index if not exists memories_event_idx on public.memories (event_id);
create index if not exists memories_publish_idx on public.memories (publish_at);

-- A sealed capsule is only visible to its author (and the admin) until it opens.
drop policy if exists memories_select on public.memories;
create policy memories_select on public.memories
  for select to authenticated
  using (
    public.is_approved()
    and (
      publish_at is null
      or publish_at <= now()
      or created_by = auth.uid()
      or public.is_admin()
    )
  );

drop policy if exists media_select on public.media;
create policy media_select on public.media
  for select to authenticated
  using (
    public.is_approved()
    and (
      memory_id is null
      or exists (
        select 1 from public.memories m
         where m.id = media.memory_id
           and (
             m.publish_at is null
             or m.publish_at <= now()
             or m.created_by = auth.uid()
             or public.is_admin()
           )
      )
    )
  );

-- A capsule answers in its own thread only once it is open.
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to authenticated
  using (
    public.is_approved()
    and (
      memory_id is null
      or exists (
        select 1 from public.memories m
         where m.id = comments.memory_id
           and (
             m.publish_at is null
             or m.publish_at <= now()
             or m.created_by = auth.uid()
             or public.is_admin()
           )
      )
    )
  );

-- ------------------------------------------------------ weekly prompt -------
create table if not exists public.circle_prompts (
  week_start date primary key,
  body       text not null,
  created_at timestamptz not null default now()
);

alter table public.circle_prompts enable row level security;

drop policy if exists circle_prompts_select on public.circle_prompts;
create policy circle_prompts_select on public.circle_prompts
  for select to authenticated using (public.is_approved());

grant select on public.circle_prompts to authenticated;
revoke all on public.circle_prompts from anon;

-- One prompt per ISO week, drawn from a small rotation so the circle always
-- has something gentle to answer.
create or replace function public.weekly_prompt()
returns table (week_start date, body text)
language plpgsql
security definer
set search_path = public
as $$
declare
  start_date date := date_trunc('week', now())::date;
  prompts text[] := array[
    'Share a song that instantly takes you back to a specific night with the circle.',
    'Post a photo from the oldest thing on your phone that still makes you smile.',
    'What is something tiny that someone here did for you and you never forgot?',
    'Drop a screenshot of the last thing that made you laugh out loud.',
    'Which place in this city would you bring everyone to tonight, and why?',
    'Show the object on your desk or in your bag that has the best story.',
    'What plan have we been talking about for years and never actually did?',
    'Post the voice note you would send the group at 2am.',
    'Name one thing you want to do with this circle before the year ends.',
    'What is a meal you still think about? Where was it and who was there?',
    'Share the last photo you took of someone else here.',
    'Tell us about a small win from this week that nobody noticed.'
  ];
  week_number integer := extract(week from now())::integer;
begin
  if not public.is_approved() then
    raise exception 'Only approved members can read the prompt';
  end if;

  insert into public.circle_prompts (week_start, body)
  values (start_date, prompts[(week_number % array_length(prompts, 1)) + 1])
  on conflict (week_start) do nothing;

  return query
    select p.week_start, p.body from public.circle_prompts p where p.week_start = start_date;
end;
$$;

revoke all on function public.weekly_prompt() from anon;
grant execute on function public.weekly_prompt() to authenticated;

-- ------------------------------------------------------------- mentions -----
alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('comment', 'reaction', 'post', 'event', 'memory', 'reminder', 'mention'));

create or replace function public.notify_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  text_body text;
  row_post uuid;
  row_memory uuid;
  row_entity uuid;
  author uuid;
  hit record;
begin
  text_body := lower(coalesce(new.body, ''));
  if text_body = '' or position('@' in text_body) = 0 then
    return new;
  end if;

  if tg_table_name = 'posts' then
    author := new.author_id;
    row_post := new.id;
    row_entity := new.id;
    text_body := lower(coalesce(new.title, '') || ' ' || coalesce(new.body, ''));
  else
    author := new.author_id;
    row_post := new.post_id;
    row_memory := new.memory_id;
    row_entity := new.id;
  end if;

  for hit in
    select p.id, p.display_name
      from public.profiles p
     where p.status = 'approved'
       and p.id <> author
       and position(lower('@' || p.display_name) in text_body) > 0
  loop
    insert into public.notifications (user_id, actor_id, kind, entity_id, post_id, memory_id, body)
    values (
      hit.id,
      author,
      'mention',
      row_entity,
      row_post,
      row_memory,
      left(coalesce(new.body, ''), 160)
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists posts_notify_mentions on public.posts;
create trigger posts_notify_mentions
  after insert on public.posts
  for each row execute function public.notify_mentions();

drop trigger if exists comments_notify_mentions on public.comments;
create trigger comments_notify_mentions
  after insert on public.comments
  for each row execute function public.notify_mentions();

-- ---------------------------------------------------------- yearly recap ----
create or replace function public.circle_recap(target_year integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  from_ts timestamptz := make_timestamptz(target_year, 1, 1, 0, 0, 0);
  to_ts timestamptz := make_timestamptz(target_year + 1, 1, 1, 0, 0, 0);
  result jsonb;
begin
  if not public.is_approved() then
    raise exception 'Only approved members can read the recap';
  end if;

  select jsonb_build_object(
    'year', target_year,
    'posts', (select count(*) from public.posts p
               where p.created_at >= from_ts and p.created_at < to_ts and p.hidden_at is null),
    'memories', (select count(*) from public.memories m
                  where m.created_at >= from_ts and m.created_at < to_ts),
    'media', (select count(*) from public.media md
               where md.created_at >= from_ts and md.created_at < to_ts),
    'comments', (select count(*) from public.comments c
                  where c.created_at >= from_ts and c.created_at < to_ts),
    'events', (select count(*) from public.events e
                where e.starts_at >= from_ts and e.starts_at < to_ts),
    'top_post', (
      select jsonb_build_object('title', coalesce(nullif(p.title, ''), left(p.body, 90)), 'reactions', count(r.user_id))
        from public.posts p
        left join public.post_reactions r on r.post_id = p.id
       where p.created_at >= from_ts and p.created_at < to_ts and p.hidden_at is null
       group by p.id, p.title, p.body
       order by count(r.user_id) desc, p.created_at asc
       limit 1
    ),
    'busiest_month', (
      select jsonb_build_object('month', to_char(date_trunc('month', p.created_at), 'FMMonth'), 'posts', count(*))
        from public.posts p
       where p.created_at >= from_ts and p.created_at < to_ts and p.hidden_at is null
       group by date_trunc('month', p.created_at)
       order by count(*) desc
       limit 1
    ),
    'most_active', (
      select jsonb_build_object('name', pr.display_name, 'actions', count(*))
        from public.posts p
        join public.profiles pr on pr.id = p.author_id
       where p.created_at >= from_ts and p.created_at < to_ts and p.hidden_at is null
       group by pr.display_name
       order by count(*) desc
       limit 1
    ),
    'years', (
      select coalesce(jsonb_agg(distinct extract(year from p.created_at)::integer order by extract(year from p.created_at)::integer desc), '[]'::jsonb)
        from public.posts p where p.hidden_at is null
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.circle_recap(integer) from anon;
grant execute on function public.circle_recap(integer) to authenticated;

-- -------------------------------------------------------- archive export ----
create or replace function public.admin_archive()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only an admin can export the archive';
  end if;

  select jsonb_build_object(
    'exported_at', now(),
    'posts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'title', p.title, 'body', p.body,
        'author', pr.display_name, 'created_at', p.created_at))
        from public.posts p left join public.profiles pr on pr.id = p.author_id
    ), '[]'::jsonb),
    'comments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', c.id, 'post_id', c.post_id, 'memory_id', c.memory_id, 'body', c.body,
        'author', pr.display_name, 'created_at', c.created_at))
        from public.comments c left join public.profiles pr on pr.id = c.author_id
    ), '[]'::jsonb),
    'memories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', m.id, 'title', m.title, 'description', m.description,
        'taken_on', m.taken_on, 'publish_at', m.publish_at,
        'author', pr.display_name, 'created_at', m.created_at))
        from public.memories m left join public.profiles pr on pr.id = m.created_by
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'title', e.title, 'description', e.description, 'location', e.location,
        'starts_at', e.starts_at, 'ends_at', e.ends_at))
        from public.events e
    ), '[]'::jsonb),
    'media', coalesce((
      select jsonb_agg(jsonb_build_object(
        'storage_path', md.storage_path, 'file_name', md.file_name, 'kind', md.kind,
        'size_bytes', md.size_bytes, 'post_id', md.post_id,
        'comment_id', md.comment_id, 'memory_id', md.memory_id, 'created_at', md.created_at))
        from public.media md
    ), '[]'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke all on function public.admin_archive() from anon;
grant execute on function public.admin_archive() to authenticated;
