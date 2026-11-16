-- Employee dashboard loads select every project and task the caller can see.
-- can_access_project() expanded members and scanned tasks once per row, and
-- can_access_task() repeated the membership lookup per task. Both exceeded the
-- authenticated role's 8s statement timeout.
--
-- Access is unchanged: admins see every row; everyone else sees a project when
-- a member id (after the same alias expansion as before) or a task assignee id
-- is one of their identities, or when they are that project's client. A task is
-- visible to its own people and to members of its project. The set is built
-- once per statement and the policy compares ids to it.

create or replace function public.self_visible_project_ids()
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ids text[] := public.self_identity_ids();
  matched text[];
begin
  if auth.uid() is null then
    return '{}'::text[];
  end if;

  if public.self_is_admin() then
    select coalesce(array_agg(p.id), '{}'::text[]) into matched from public.projects p;
    return coalesce(matched, '{}'::text[]);
  end if;

  with seeds as (
    select m.user_id as sid
    from public.projects p
    cross join lateral public.collect_project_member_ids(coalesce(p.data, '{}'::jsonb)) m
    union
    select a.user_id
    from public.tasks t
    cross join lateral public.collect_task_assignee_ids(coalesce(t.data, '{}'::jsonb)) a
  ),
  hit as (
    select s.sid
    from seeds s
    where s.sid = any (ids)
       or exists (
         select 1
         from public.expand_person_ids(array[s.sid]) x
         where x.user_id = any (ids)
       )
  )
  select coalesce(array_agg(distinct pid), '{}'::text[])
    into matched
  from (
    select p.id as pid
    from public.projects p
    where exists (
      select 1
      from public.collect_project_member_ids(coalesce(p.data, '{}'::jsonb)) m
      join hit h on h.sid = m.user_id
    )
    or (
      public.self_role() = 'client'
      and coalesce(p.data->>'clientId', '') <> ''
      and p.data->>'clientId' = any (ids)
    )
    union
    select nullif(t.data->>'projectId', '') as pid
    from public.tasks t
    where exists (
      select 1
      from public.collect_task_assignee_ids(coalesce(t.data, '{}'::jsonb)) a
      join hit h on h.sid = a.user_id
    )
  ) s
  where coalesce(pid, '') <> '';

  return coalesce(matched, '{}'::text[]);
end;
$$;

-- Membership and client only. Task assignees do not see sibling tasks.
create or replace function public.self_member_project_ids()
returns text[]
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ids text[] := public.self_identity_ids();
  matched text[];
begin
  if auth.uid() is null then
    return '{}'::text[];
  end if;

  if public.self_is_admin() then
    select coalesce(array_agg(p.id), '{}'::text[]) into matched from public.projects p;
    return coalesce(matched, '{}'::text[]);
  end if;

  select coalesce(array_agg(p.id), '{}'::text[])
    into matched
  from public.projects p
  where exists (
    select 1
    from public.collect_project_member_ids(coalesce(p.data, '{}'::jsonb)) m
    where m.user_id = any (ids)
  )
  or (
    public.self_role() = 'client'
    and coalesce(p.data->>'clientId', '') <> ''
    and p.data->>'clientId' = any (ids)
  );

  return coalesce(matched, '{}'::text[]);
end;
$$;

create or replace function public.can_access_project(row_id text, row_data jsonb)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select auth.uid()) is not null
    and (
      (select public.self_is_admin())
      or row_id = any (select unnest(public.self_visible_project_ids()))
    );
$$;

create or replace function public.can_access_project_id(p_project_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select public.self_is_admin())
    or p_project_id = any (select unnest(public.self_visible_project_ids()));
$$;

create or replace function public.can_access_task(row_data jsonb)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (select auth.uid()) is not null
    and (
      (select public.self_is_admin())
      or public.task_person_ids(coalesce(row_data, '{}'::jsonb)) && (select public.self_identity_ids())
      or coalesce(row_data->>'projectId', '') = any (select unnest(public.self_member_project_ids()))
    );
$$;

grant execute on function public.self_visible_project_ids() to anon, authenticated, service_role;
grant execute on function public.self_member_project_ids() to anon, authenticated, service_role;

-- Policies call the once-per-statement helpers directly. A security definer
-- wrapper would run the helper again on every row.
drop policy if exists projects_select on public.projects;
drop policy if exists projects_write on public.projects;

create policy projects_select on public.projects
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and (
      (select public.self_is_admin())
      or id = any (select unnest(public.self_visible_project_ids()))
    )
  );

create policy projects_write on public.projects
  for all to authenticated
  using (
    (select auth.uid()) is not null
    and (
      (select public.self_is_admin())
      or id = any (select unnest(public.self_visible_project_ids()))
    )
  )
  with check (
    (
      (select auth.uid()) is not null
      and (
        (select public.self_is_admin())
        or id = any (select unnest(public.self_visible_project_ids()))
      )
    )
    or coalesce(data->>'createdBy', '') = any (select unnest(public.self_identity_ids()))
  );

drop policy if exists tasks_select on public.tasks;
drop policy if exists tasks_write on public.tasks;

create policy tasks_select on public.tasks
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and (
      (select public.self_is_admin())
      or public.task_person_ids(coalesce(data, '{}'::jsonb)) && (select public.self_identity_ids())
      or coalesce(data->>'projectId', '') = any (select unnest(public.self_member_project_ids()))
    )
  );

create policy tasks_write on public.tasks
  for all to authenticated
  using (
    (select auth.uid()) is not null
    and (
      (select public.self_is_admin())
      or public.task_person_ids(coalesce(data, '{}'::jsonb)) && (select public.self_identity_ids())
      or coalesce(data->>'projectId', '') = any (select unnest(public.self_member_project_ids()))
    )
  )
  with check (
    (
      (select auth.uid()) is not null
      and (
        (select public.self_is_admin())
        or public.task_person_ids(coalesce(data, '{}'::jsonb)) && (select public.self_identity_ids())
        or coalesce(data->>'projectId', '') = any (select unnest(public.self_member_project_ids()))
      )
    )
    or coalesce(data->>'createdBy', '') = any (select unnest(public.self_identity_ids()))
  );

drop policy if exists project_process_steps_select on public.project_process_steps;
drop policy if exists project_process_steps_write on public.project_process_steps;

create policy project_process_steps_select on public.project_process_steps
  for select to authenticated
  using (
    (select public.self_is_admin())
    or coalesce(parent_id, data->>'projectId', '') = any (select unnest(public.self_visible_project_ids()))
  );

create policy project_process_steps_write on public.project_process_steps
  for all to authenticated
  using (
    (select public.self_is_admin())
    or coalesce(parent_id, data->>'projectId', '') = any (select unnest(public.self_visible_project_ids()))
  )
  with check (
    (select public.self_is_admin())
    or coalesce(parent_id, data->>'projectId', '') = any (select unnest(public.self_visible_project_ids()))
  );

drop policy if exists project_timeline_select on public.project_timeline;
drop policy if exists project_timeline_write on public.project_timeline;

create policy project_timeline_select on public.project_timeline
  for select to authenticated
  using (
    (select public.self_is_admin())
    or coalesce(parent_id, data->>'projectId', '') = any (select unnest(public.self_visible_project_ids()))
  );

create policy project_timeline_write on public.project_timeline
  for all to authenticated
  using (
    (select public.self_is_admin())
    or coalesce(parent_id, data->>'projectId', '') = any (select unnest(public.self_visible_project_ids()))
  )
  with check (
    (select public.self_is_admin())
    or coalesce(parent_id, data->>'projectId', '') = any (select unnest(public.self_visible_project_ids()))
  );

drop policy if exists project_notes_select on public.project_notes;
drop policy if exists project_notes_write on public.project_notes;

create policy project_notes_select on public.project_notes
  for select to authenticated
  using (
    (select public.self_is_admin())
    or coalesce(data->>'projectId', parent_id, '') = any (select unnest(public.self_visible_project_ids()))
  );

create policy project_notes_write on public.project_notes
  for all to authenticated
  using (
    (select public.self_is_admin())
    or coalesce(data->>'projectId', parent_id, '') = any (select unnest(public.self_visible_project_ids()))
  )
  with check (
    (select public.self_is_admin())
    or coalesce(data->>'projectId', parent_id, '') = any (select unnest(public.self_visible_project_ids()))
  );
