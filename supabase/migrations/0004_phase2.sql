-- ============================================================================
-- STFU — phase 2: event reminders, profile covers, admin tools
-- Safe to re-run.
-- ============================================================================

-- --------------------------------------------------------- profile covers --
alter table public.profiles add column if not exists cover_url text;

grant select (cover_url) on public.profiles to authenticated;
grant update (cover_url) on public.profiles to authenticated;

-- -------------------------------------------------------- event reminders --
alter table public.events add column if not exists reminded_at timestamptz;

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('comment', 'reaction', 'post', 'event', 'memory', 'reminder'));

create or replace function public.queue_event_reminders()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  due record;
  queued integer := 0;
begin
  for due in
    select e.id, e.title, e.created_by
      from public.events e
     where e.reminded_at is null
       and e.starts_at between now() and now() + interval '24 hours'
  loop
    insert into public.notifications (user_id, actor_id, kind, entity_id, body)
    select p.id, due.created_by, 'reminder', due.id, due.title
      from public.profiles p
     where p.status = 'approved'
       and p.id <> due.created_by;

    update public.events set reminded_at = now() where id = due.id;
    queued := queued + 1;
  end loop;

  return queued;
end;
$$;

revoke all on function public.queue_event_reminders() from public, anon, authenticated;

-- Hourly sweep when pg_cron is available on the project.
do $$
begin
  create extension if not exists pg_cron;
exception
  when others then null;
end;
$$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    begin
      perform cron.unschedule('stfu-event-reminders');
    exception
      when others then null;
    end;
    perform cron.schedule('stfu-event-reminders', '5 * * * *', 'select public.queue_event_reminders();');
  end if;
end;
$$;

-- ---------------------------------------------------------- admin audit --
create table if not exists public.admin_audit (
  id         bigserial primary key,
  actor_id   uuid references public.profiles (id) on delete set null,
  target_id  uuid references public.profiles (id) on delete set null,
  action     text not null,
  detail     text,
  created_at timestamptz not null default now()
);

create index if not exists admin_audit_created_idx on public.admin_audit (created_at desc);

alter table public.admin_audit enable row level security;

drop policy if exists admin_audit_select on public.admin_audit;
create policy admin_audit_select on public.admin_audit
  for select to authenticated using (public.is_admin());

grant select on public.admin_audit to authenticated;
revoke all on public.admin_audit from anon;

create or replace function public.log_profile_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    insert into public.admin_audit (actor_id, target_id, action, detail)
    values (auth.uid(), new.id, 'status', coalesce(old.status, '?') || ' → ' || new.status);
  end if;

  if new.role is distinct from old.role then
    insert into public.admin_audit (actor_id, target_id, action, detail)
    values (auth.uid(), new.id, 'role', coalesce(old.role, '?') || ' → ' || new.role);
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit
  after update on public.profiles
  for each row execute function public.log_profile_change();

-- --------------------------------------------------------- storage stats --
create or replace function public.admin_storage_stats()
returns table (
  file_count   bigint,
  total_bytes  bigint,
  image_bytes  bigint,
  video_bytes  bigint,
  audio_bytes  bigint,
  bucket_bytes bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(count(*), 0),
    coalesce(sum(m.size_bytes), 0),
    coalesce(sum(m.size_bytes) filter (where m.kind = 'image'), 0),
    coalesce(sum(m.size_bytes) filter (where m.kind = 'video'), 0),
    coalesce(sum(m.size_bytes) filter (where m.kind = 'audio'), 0),
    coalesce((select sum((o.metadata ->> 'size')::bigint) from storage.objects o where o.bucket_id = 'media'), 0)
  from public.media m
  where public.is_admin();
$$;

grant execute on function public.admin_storage_stats() to authenticated;
revoke execute on function public.admin_storage_stats() from anon;
