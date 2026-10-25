-- ============================================================================
-- STFU — phase 3: post categories, live presence and web push
-- Safe to re-run: every object is created only when missing.
-- ============================================================================

-- ------------------------------------------------------------- categories --
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(btrim(name)) between 1 and 32),
  slug       text not null unique,
  accent     text not null default 'blue'
             check (accent in ('blue', 'violet', 'green', 'amber', 'rose', 'slate')),
  position   integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists categories_order_idx on public.categories (position, name);

alter table public.categories enable row level security;

drop policy if exists categories_select on public.categories;
create policy categories_select on public.categories
  for select to authenticated using (public.is_approved());

drop policy if exists categories_write on public.categories;
create policy categories_write on public.categories
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.categories to authenticated;
revoke all on public.categories from anon;

-- Labels are typed by the admin; the slug is derived from the label so links
-- stay readable and stable.
create or replace function public.slugify(value text)
returns text
language sql
immutable
as $$
  select trim(both '-' from regexp_replace(
    lower(translate(coalesce(value, ''),
      'şŞıİğĞüÜöÖçÇâÂîÎûÛ',
      'sSiIgGuUoOcCaAiiuU')),
    '[^a-z0-9]+', '-', 'g'));
$$;

create or replace function public.categories_before_write()
returns trigger
language plpgsql
as $$
begin
  new.name := btrim(new.name);
  if tg_op = 'INSERT' then
    if new.slug is null or btrim(new.slug) = '' then
      new.slug := public.slugify(new.name);
    else
      new.slug := public.slugify(new.slug);
    end if;
  elsif new.name is distinct from old.name and new.slug is not distinct from old.slug then
    new.slug := public.slugify(new.name);
  end if;

  if new.slug is null or new.slug = '' then
    raise exception 'A category name needs at least one letter or number';
  end if;
  return new;
end;
$$;

drop trigger if exists categories_before_write on public.categories;
create trigger categories_before_write
  before insert or update on public.categories
  for each row execute function public.categories_before_write();

-- ------------------------------------------------------------ post tagging --
alter table public.posts
  add column if not exists category_id uuid references public.categories (id) on delete set null;

create index if not exists posts_category_idx on public.posts (category_id, created_at desc);

-- Authors may still edit their own posts, but the label itself belongs to the
-- admin so a tag always means what the circle agreed it means.
create or replace function public.protect_post_category()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.category_id is distinct from old.category_id and not public.is_admin() then
    raise exception 'Only an admin can label a post';
  end if;
  return new;
end;
$$;

drop trigger if exists posts_protect_category on public.posts;
create trigger posts_protect_category
  before update on public.posts
  for each row execute function public.protect_post_category();

-- ---------------------------------------------------- presence (realtime) --
-- Approved members may use presence channels; anyone else with a session
-- (a sign-up waiting for approval, for example) may not.
do $$
begin
  alter table realtime.messages enable row level security;
exception
  when insufficient_privilege then null;
  when undefined_table then null;
end;
$$;

drop policy if exists realtime_presence_read on realtime.messages;
create policy realtime_presence_read on realtime.messages
  for select to authenticated using (public.is_approved());

drop policy if exists realtime_presence_write on realtime.messages;
create policy realtime_presence_write on realtime.messages
  for insert to authenticated with check (public.is_approved());

-- ------------------------------------------------------------ push devices --
create table if not exists public.push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  endpoint        text not null unique,
  p256dh          text not null,
  auth            text not null,
  user_agent      text,
  created_at      timestamptz not null default now(),
  last_success_at timestamptz,
  failed_at       timestamptz
);

create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_select on public.push_subscriptions;
create policy push_subscriptions_select on public.push_subscriptions
  for select to authenticated using (user_id = auth.uid());

drop policy if exists push_subscriptions_insert on public.push_subscriptions;
create policy push_subscriptions_insert on public.push_subscriptions
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_approved());

drop policy if exists push_subscriptions_update on public.push_subscriptions;
create policy push_subscriptions_update on public.push_subscriptions
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists push_subscriptions_delete on public.push_subscriptions;
create policy push_subscriptions_delete on public.push_subscriptions
  for delete to authenticated using (user_id = auth.uid() or public.is_admin());

grant select, insert, update, delete on public.push_subscriptions to authenticated;
revoke all on public.push_subscriptions from anon;

-- -------------------------------------------------------- push dispatching --
-- The endpoint and its shared secret live here; nobody but the definer
-- function (and the service role) can read them.
create table if not exists public.push_dispatch_config (
  id            boolean primary key default true check (id),
  function_url  text not null,
  shared_secret text not null
);

alter table public.push_dispatch_config enable row level security;
revoke all on public.push_dispatch_config from anon;
revoke all on public.push_dispatch_config from authenticated;

create extension if not exists pg_net;

create or replace function public.dispatch_push_notification()
returns trigger
language plpgsql
security definer
set search_path = public, net, extensions
as $$
declare
  cfg public.push_dispatch_config;
begin
  select * into cfg from public.push_dispatch_config where id limit 1;
  if cfg.function_url is null then
    return new;
  end if;

  begin
    perform net.http_post(
      url := cfg.function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', cfg.shared_secret
      ),
      body := jsonb_build_object('notification_id', new.id),
      timeout_milliseconds := 5000
    );
  exception
    when others then null; -- a push must never block the row that caused it
  end;

  return new;
end;
$$;

drop trigger if exists notifications_dispatch_push on public.notifications;
create trigger notifications_dispatch_push
  after insert on public.notifications
  for each row execute function public.dispatch_push_notification();
