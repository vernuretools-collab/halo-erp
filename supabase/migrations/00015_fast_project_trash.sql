-- Move, restore, and permanently delete a project in one statement
-- instead of a round trip per task.

create or replace function public.trash_project(p_project_id text, p_actor jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_count int;
begin
  update public.projects
  set data = coalesce(data, '{}'::jsonb) || coalesce(p_actor, '{}'::jsonb),
      updated_at = now()
  where id = p_project_id;
  get diagnostics updated_count = row_count;
  if updated_count = 0 then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;

  update public.tasks
  set data = coalesce(data, '{}'::jsonb)
        || coalesce(p_actor, '{}'::jsonb)
        || jsonb_build_object('deletedWithProject', p_project_id),
      updated_at = now()
  where data->>'projectId' = p_project_id
    and coalesce(data->>'deletedAt', '') = '';
end;
$$;

create or replace function public.restore_project(p_project_id text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  trash_keys text[] := array['deletedAt', 'deletedBy', 'deletedByName', 'deletedWithProject'];
  updated_count int;
begin
  update public.projects
  set data = coalesce(data, '{}'::jsonb) - trash_keys,
      updated_at = now()
  where id = p_project_id;
  get diagnostics updated_count = row_count;
  if updated_count = 0 then
    raise exception 'Project not found' using errcode = 'P0002';
  end if;

  update public.tasks
  set data = coalesce(data, '{}'::jsonb) - trash_keys,
      updated_at = now()
  where data->>'deletedWithProject' = p_project_id;
end;
$$;

create or replace function public.purge_project(p_project_id text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  delete from public.tasks
  where data->>'projectId' = p_project_id;

  delete from public.projects
  where id = p_project_id;
end;
$$;

grant execute on function public.trash_project(text, jsonb) to authenticated;
grant execute on function public.restore_project(text) to authenticated;
grant execute on function public.purge_project(text) to authenticated;
