-- ============================================================================
-- STFU — let the timeline hear about new posts without reloading.
-- Safe to re-run: adding an existing table to the publication is ignored.
-- ============================================================================

do $$
begin
  alter publication supabase_realtime add table public.posts;
exception
  when duplicate_object then null;
  when undefined_object then null;
end;
$$;
