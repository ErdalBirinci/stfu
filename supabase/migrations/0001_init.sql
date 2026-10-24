-- ============================================================================
-- STFU — private circle schema
-- Run this once in your Supabase project: SQL Editor → New query → paste → Run.
-- It is safe to re-run: every object is created only when missing.
-- ============================================================================

-- ---------------------------------------------------------------- profiles --
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  email        text,
  display_name text not null default 'Friend' check (char_length(display_name) between 1 and 60),
  avatar_url   text,
  bio          text check (char_length(bio) <= 280),
  role         text not null default 'member' check (role in ('admin', 'member')),
  status       text not null default 'pending'
               check (status in ('pending', 'approved', 'rejected', 'suspended')),
  created_at   timestamptz not null default now(),
  approved_at  timestamptz,
  updated_at   timestamptz not null default now()
);

comment on table public.profiles is 'One row per auth user. status controls access to the whole circle.';

-- ------------------------------------------------------------------ gates --
-- security definer helpers so policies can look at the caller's profile
-- without tripping over profiles' own row level security.
create or replace function public.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.status = 'approved'
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.status = 'approved'
  );
$$;

grant execute on function public.is_approved() to authenticated;
grant execute on function public.is_admin() to authenticated;

-- -------------------------------------------------------------- new users --
-- The very first account becomes the admin and is approved immediately, so a
-- fresh project is never locked out. Everybody after that lands in the queue.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  first_member boolean;
begin
  select not exists (select 1 from public.profiles) into first_member;

  insert into public.profiles (id, email, display_name, role, status, approved_at)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, 'friend@example.com'), '@', 1)
    ),
    case when first_member then 'admin' else 'member' end,
    case when first_member then 'approved' else 'pending' end,
    case when first_member then now() else null end
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Members may edit their own profile, but never their role or status.
create or replace function public.protect_profile_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    new.role := old.role;
    new.status := old.status;
    new.email := old.email;
    new.approved_at := old.approved_at;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_fields on public.profiles;
create trigger profiles_protect_fields
  before update on public.profiles
  for each row execute function public.protect_profile_fields();

-- Manual bootstrap (run in the SQL editor only, never from the app):
--   select public.make_admin('you@example.com');
create or replace function public.make_admin(target_email text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set role = 'admin',
         status = 'approved',
         approved_at = coalesce(approved_at, now())
   where lower(email) = lower(target_email);

  if not found then
    raise exception 'No profile found for %', target_email;
  end if;
end;
$$;

revoke all on function public.make_admin(text) from public, anon, authenticated;

-- ------------------------------------------------------------------- posts --
create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 140),
  body       text not null default '' check (char_length(body) <= 8000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);

-- ---------------------------------------------------------------- comments --
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  parent_id  uuid references public.comments (id) on delete cascade,
  body       text not null default '' check (char_length(body) <= 4000),
  created_at timestamptz not null default now()
);

create index if not exists comments_post_idx on public.comments (post_id, created_at);

-- ------------------------------------------------------------------ events --
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 4000),
  location    text check (char_length(location) <= 160),
  starts_at   timestamptz not null,
  ends_at     timestamptz,
  all_day     boolean not null default false,
  created_by  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  constraint events_time_order check (ends_at is null or ends_at >= starts_at)
);

create index if not exists events_starts_at_idx on public.events (starts_at);

create table if not exists public.event_attendees (
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  status     text not null check (status in ('going', 'maybe', 'declined')),
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_attendees_user_idx on public.event_attendees (user_id);

-- ---------------------------------------------------------------- memories --
create table if not exists public.memories (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 120),
  description text check (char_length(description) <= 4000),
  taken_on    date,
  created_by  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists memories_created_at_idx on public.memories (created_at desc);

-- ------------------------------------------------------------------- media --
create table if not exists public.media (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  kind         text not null check (kind in ('image', 'video', 'audio')),
  storage_path text not null unique,
  file_name    text not null,
  mime_type    text,
  size_bytes   bigint not null default 0,
  post_id      uuid references public.posts (id) on delete cascade,
  comment_id   uuid references public.comments (id) on delete cascade,
  memory_id    uuid references public.memories (id) on delete cascade,
  created_at   timestamptz not null default now(),
  constraint media_has_parent check (num_nonnulls(post_id, comment_id, memory_id) >= 1)
);

create index if not exists media_post_idx on public.media (post_id);
create index if not exists media_comment_idx on public.media (comment_id);
create index if not exists media_memory_idx on public.media (memory_id);

-- ============================================================================
-- Row level security: nothing is readable until an admin approves the member.
-- ============================================================================
alter table public.profiles        enable row level security;
alter table public.posts           enable row level security;
alter table public.comments        enable row level security;
alter table public.events          enable row level security;
alter table public.event_attendees enable row level security;
alter table public.memories        enable row level security;
alter table public.media           enable row level security;

-- profiles ------------------------------------------------------------------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_approved());

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

drop policy if exists profiles_admin_delete on public.profiles;
create policy profiles_admin_delete on public.profiles
  for delete to authenticated
  using (public.is_admin() and id <> auth.uid());

-- posts ---------------------------------------------------------------------
drop policy if exists posts_select on public.posts;
create policy posts_select on public.posts
  for select to authenticated using (public.is_approved());

drop policy if exists posts_insert on public.posts;
create policy posts_insert on public.posts
  for insert to authenticated with check (public.is_approved() and author_id = auth.uid());

drop policy if exists posts_update on public.posts;
create policy posts_update on public.posts
  for update to authenticated
  using (author_id = auth.uid() or public.is_admin())
  with check (author_id = auth.uid() or public.is_admin());

drop policy if exists posts_delete on public.posts;
create policy posts_delete on public.posts
  for delete to authenticated using (author_id = auth.uid() or public.is_admin());

-- comments ------------------------------------------------------------------
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select to authenticated using (public.is_approved());

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert to authenticated with check (public.is_approved() and author_id = auth.uid());

drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments
  for delete to authenticated using (author_id = auth.uid() or public.is_admin());

-- events --------------------------------------------------------------------
drop policy if exists events_select on public.events;
create policy events_select on public.events
  for select to authenticated using (public.is_approved());

drop policy if exists events_insert on public.events;
create policy events_insert on public.events
  for insert to authenticated with check (public.is_approved() and created_by = auth.uid());

drop policy if exists events_update on public.events;
create policy events_update on public.events
  for update to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

drop policy if exists events_delete on public.events;
create policy events_delete on public.events
  for delete to authenticated using (created_by = auth.uid() or public.is_admin());

-- rsvps ---------------------------------------------------------------------
drop policy if exists attendees_select on public.event_attendees;
create policy attendees_select on public.event_attendees
  for select to authenticated using (public.is_approved());

drop policy if exists attendees_upsert on public.event_attendees;
create policy attendees_upsert on public.event_attendees
  for insert to authenticated with check (public.is_approved() and user_id = auth.uid());

drop policy if exists attendees_update on public.event_attendees;
create policy attendees_update on public.event_attendees
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists attendees_delete on public.event_attendees;
create policy attendees_delete on public.event_attendees
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- memories ------------------------------------------------------------------
drop policy if exists memories_select on public.memories;
create policy memories_select on public.memories
  for select to authenticated using (public.is_approved());

drop policy if exists memories_insert on public.memories;
create policy memories_insert on public.memories
  for insert to authenticated with check (public.is_approved() and created_by = auth.uid());

drop policy if exists memories_update on public.memories;
create policy memories_update on public.memories
  for update to authenticated
  using (created_by = auth.uid() or public.is_admin())
  with check (created_by = auth.uid() or public.is_admin());

drop policy if exists memories_delete on public.memories;
create policy memories_delete on public.memories
  for delete to authenticated using (created_by = auth.uid() or public.is_admin());

-- media ---------------------------------------------------------------------
drop policy if exists media_select on public.media;
create policy media_select on public.media
  for select to authenticated using (public.is_approved());

drop policy if exists media_insert on public.media;
create policy media_insert on public.media
  for insert to authenticated with check (public.is_approved() and owner_id = auth.uid());

drop policy if exists media_delete on public.media;
create policy media_delete on public.media
  for delete to authenticated using (owner_id = auth.uid() or public.is_admin());

-- ============================================================================
-- Admin member directory: the only place emails are exposed, and only to admins.
-- ============================================================================
create or replace function public.admin_members()
returns table (
  id uuid,
  email text,
  display_name text,
  avatar_url text,
  bio text,
  role text,
  status text,
  created_at timestamptz,
  approved_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select p.id, p.email, p.display_name, p.avatar_url, p.bio, p.role, p.status,
         p.created_at, p.approved_at
    from public.profiles p
   where public.is_admin()
   order by case p.status when 'pending' then 0 else 1 end, p.created_at desc;
$$;

grant execute on function public.admin_members() to authenticated;
revoke execute on function public.admin_members() from anon;

-- Column level privacy: approved members can see names and avatars, but the
-- email column (and role/status editing) stays with admins and the profile owner.
revoke all on table public.profiles from anon, authenticated;
grant select (id, display_name, avatar_url, bio, role, status, created_at, approved_at)
  on public.profiles to authenticated;
grant update (display_name, bio, avatar_url, role, status, email, approved_at, updated_at)
  on public.profiles to authenticated;
grant delete on public.profiles to authenticated;

-- ============================================================================
-- Storage: one private bucket, readable only by approved members.
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 52428800, array['image/*', 'video/*', 'audio/*'])
on conflict (id) do update
  set public = false,
      file_size_limit = 52428800,
      allowed_mime_types = array['image/*', 'video/*', 'audio/*'];

drop policy if exists "media read for the circle" on storage.objects;
create policy "media read for the circle" on storage.objects
  for select to authenticated
  using (bucket_id = 'media' and public.is_approved());

drop policy if exists "media upload to own folder" on storage.objects;
create policy "media upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'media'
    and public.is_approved()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "media update own folder" on storage.objects;
create policy "media update own folder" on storage.objects
  for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "media delete own folder" on storage.objects;
create policy "media delete own folder" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'media'
    and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
  );

-- ============================================================================
-- Done. Next: Authentication → Providers → Email, and decide whether email
-- confirmation is required for this closed group.
-- ============================================================================
