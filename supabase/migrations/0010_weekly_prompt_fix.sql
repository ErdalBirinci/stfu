-- ============================================================================
-- STFU — weekly_prompt(): the ON CONFLICT target needs the constraint name,
-- otherwise it collides with the returned column of the same name.
-- ============================================================================

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
  on conflict on constraint circle_prompts_pkey do nothing;

  return query
    select c.week_start, c.body from public.circle_prompts c where c.week_start = start_date;
end;
$$;

revoke all on function public.weekly_prompt() from anon;
grant execute on function public.weekly_prompt() to authenticated;
