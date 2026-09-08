-- Projects and tasks are private to the people working on them.
--
-- 00001 gave both tables the blanket can_access_row() policy, which 00006 kept
-- company-wide: any authenticated employee could read and write every project
-- and task row (and rows whose user_id was never populated were readable by
-- everyone). Visibility was therefore only enforced by the React filters in
-- employee-portal/src/features/projects/services/projectService.js.
--
-- A project is now visible to admins, the people listed on it (creator,
-- members, assignedEmployeeIds, employeeId, assignedTo), anyone assigned a task
-- inside it, and the client it belongs to. A task is visible to admins, its
-- creator/assignee, and anyone who can see its project.

-- is_admin() reads the role from app_metadata, which sync_profile_claims()
-- writes. Any session with a stale token would lose access to every project, so
-- fall back to the role stored on the profile/employee row.
create or replace function public.self_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    nullif(public.app_role(), ''),
    (select lower(nullif(p.data->>'role', '')) from public.profiles p
      where p.auth_id = auth.uid() limit 1),
    (select lower(nullif(e.data->>'role', '')) from public.employees e
      where e.auth_id = auth.uid() limit 1),
    (select lower(nullif(p.data->>'role', '')) from public.profiles p
      where nullif(lower(p.data->>'email'), '') = lower(auth.jwt() ->> 'email') limit 1),
    (select lower(nullif(e.data->>'role', '')) from public.employees e
      where nullif(lower(e.data->>'email'), '') = lower(auth.jwt() ->> 'email') limit 1),
    ''
  );
$$;

create or replace function public.self_is_admin()
returns boolean
language sql
stable
as $$
  select public.self_role() in ('admin', 'owner', 'superadmin');
$$;

-- security definer so the predicates can read projects/tasks without
-- re-entering these policies, which is what would otherwise recurse between the
-- two tables.
create or replace function public.can_access_project(row_id text, row_data jsonb)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      public.self_is_admin()
      -- creator / members / assignedEmployeeIds / employeeId / assignedTo
      or exists (
        select 1
        from public.expand_person_ids(array(
          select c.user_id
          from public.collect_project_member_ids(coalesce(row_data, '{}'::jsonb)) c
        )) m
        where m.user_id = any (public.self_identity_ids())
      )
      -- assigned to (or creator of) a task inside the project
      or exists (
        select 1
        from public.tasks t
        where t.data->>'projectId' = row_id
          and exists (
            select 1
            from public.expand_person_ids(array(
              select a.user_id
              from public.collect_task_assignee_ids(coalesce(t.data, '{}'::jsonb)) a
            )) x
            where x.user_id = any (public.self_identity_ids())
          )
      )
      -- the client portal reads its own projects
      or (
        public.self_role() = 'client'
        and coalesce(row_data->>'clientId', '') <> ''
        and row_data->>'clientId' = any (public.self_identity_ids())
      )
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
    public.self_is_admin()
    or exists (
      select 1
      from public.projects p
      where p.id = p_project_id
        and public.can_access_project(p.id, p.data)
    );
$$;

create or replace function public.can_access_task(row_data jsonb)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      public.self_is_admin()
      or exists (
        select 1
        from public.expand_person_ids(array(
          select a.user_id
          from public.collect_task_assignee_ids(coalesce(row_data, '{}'::jsonb)) a
        )) x
        where x.user_id = any (public.self_identity_ids())
      )
      -- everyone on the project sees the project's tasks
      or public.can_access_project_id(coalesce(row_data->>'projectId', ''))
    );
$$;

-- can_access_project() looks tasks up by their JSON projectId on every row.
create index if not exists tasks_project_id_idx on public.tasks ((data->>'projectId'));
create index if not exists project_notes_project_id_idx on public.project_notes ((data->>'projectId'));

drop policy if exists projects_select on public.projects;
drop policy if exists projects_write on public.projects;

create policy projects_select on public.projects
  for select to authenticated
  using (public.can_access_project(id, data));

create policy projects_write on public.projects
  for all to authenticated
  using (public.can_access_project(id, data))
  with check (
    public.can_access_project(id, data)
    or coalesce(data->>'createdBy', '') = any (public.self_identity_ids())
  );

drop policy if exists tasks_select on public.tasks;
drop policy if exists tasks_write on public.tasks;

create policy tasks_select on public.tasks
  for select to authenticated
  using (public.can_access_task(data));

create policy tasks_write on public.tasks
  for all to authenticated
  using (public.can_access_task(data))
  with check (
    public.can_access_task(data)
    or coalesce(data->>'createdBy', '') = any (public.self_identity_ids())
  );

-- Child records inherit the parent project's audience. Without this, process
-- steps and timeline entries stay readable by the whole company.
drop policy if exists project_process_steps_select on public.project_process_steps;
drop policy if exists project_process_steps_write on public.project_process_steps;

create policy project_process_steps_select on public.project_process_steps
  for select to authenticated
  using (public.can_access_project_id(coalesce(parent_id, data->>'projectId', '')));

create policy project_process_steps_write on public.project_process_steps
  for all to authenticated
  using (public.can_access_project_id(coalesce(parent_id, data->>'projectId', '')))
  with check (public.can_access_project_id(coalesce(parent_id, data->>'projectId', '')));

drop policy if exists project_timeline_select on public.project_timeline;
drop policy if exists project_timeline_write on public.project_timeline;

create policy project_timeline_select on public.project_timeline
  for select to authenticated
  using (public.can_access_project_id(coalesce(parent_id, data->>'projectId', '')));

create policy project_timeline_write on public.project_timeline
  for all to authenticated
  using (public.can_access_project_id(coalesce(parent_id, data->>'projectId', '')))
  with check (public.can_access_project_id(coalesce(parent_id, data->>'projectId', '')));

drop policy if exists project_notes_select on public.project_notes;
drop policy if exists project_notes_write on public.project_notes;

create policy project_notes_select on public.project_notes
  for select to authenticated
  using (public.can_access_project_id(coalesce(data->>'projectId', parent_id, '')));

create policy project_notes_write on public.project_notes
  for all to authenticated
  using (public.can_access_project_id(coalesce(data->>'projectId', parent_id, '')))
  with check (public.can_access_project_id(coalesce(data->>'projectId', parent_id, '')));

-- The compat layer derives user_id from data.uid/employeeId/userId only, so
-- rows created from the portals carry a null owner. Backfill it so owns_row()
-- and anything else keyed on user_id agrees with the policies above.
update public.projects
set user_id = coalesce(
  nullif(user_id, ''),
  nullif(data->>'employeeId', ''),
  nullif(data->>'createdBy', '')
)
where coalesce(user_id, '') = ''
  and coalesce(data->>'employeeId', data->>'createdBy', '') <> '';

update public.tasks
set user_id = coalesce(
  nullif(user_id, ''),
  nullif(data->>'assigneeId', ''),
  nullif(data->>'employeeId', ''),
  nullif(data->>'createdBy', '')
)
where coalesce(user_id, '') = ''
  and coalesce(data->>'assigneeId', data->>'employeeId', data->>'createdBy', '') <> '';
