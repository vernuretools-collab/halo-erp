-- Broadcast process stages and project timeline so the client portal
-- updates without a refresh. Replica identity full is required so realtime
-- payloads include the full row.

alter table public.project_process_steps replica identity full;
alter table public.project_timeline replica identity full;

do $$
declare
  t text;
begin
  foreach t in array array['project_process_steps', 'project_timeline'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception
      when duplicate_object then null;
      when undefined_object then null;
    end;
  end loop;
end $$;
