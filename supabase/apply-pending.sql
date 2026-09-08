-- Pending migrations 00003-00007, concatenated in dependency order.
-- 00001/00002 are already live. Run this whole file once in the Supabase SQL editor.
begin;

-- ======================================================================
-- 00003_employee_directory_access.sql
-- ======================================================================
-- Employee directory visibility: org-scoped SELECT, tighter writes,
-- profile dedupe, unique auth_id, backfill employees from profiles.

create or replace function public.company_org_id()
returns text
language sql
stable
as $$
  select coalesce(nullif(public.jwt_claim('orgId'), ''), 'org_demo');
$$;

create or replace function public.same_company_org(row_org text)
returns boolean
language sql
stable
as $$
  select
    row_org is null
    or public.company_org_id() is null
    or row_org = public.company_org_id()
    or (
      row_org in ('org_demo', 'org_real')
      and public.company_org_id() in ('org_demo', 'org_real')
    );
$$;

create or replace function public.can_access_row(org_id text, user_id text)
returns boolean
language sql
stable
as $$
  select
    auth.uid() is not null
    and (
      public.is_admin()
      or user_id is null
      or user_id = public.jwt_uid()
      or public.same_company_org(org_id)
    );
$$;

drop policy if exists employees_select on public.employees;
drop policy if exists employees_write on public.employees;

create policy employees_select on public.employees
  for select to authenticated
  using (
    public.is_admin()
    or public.same_company_org(org_id)
    or user_id = public.jwt_uid()
  );

create policy employees_write on public.employees
  for all to authenticated
  using (public.is_admin() or user_id = public.jwt_uid())
  with check (public.is_admin() or user_id = public.jwt_uid());

-- Normalize tenant ids so JWT orgId matches directory rows
update public.employees
set org_id = coalesce(nullif(org_id, ''), data->>'orgId', 'org_demo')
where org_id is null or org_id = '';

update public.profiles
set
  org_id = coalesce(nullif(org_id, ''), data->>'orgId', 'org_demo'),
  data = data || jsonb_build_object(
    'orgId', coalesce(data->>'orgId', nullif(org_id, ''), 'org_demo')
  );

update public.employees
set data = data || jsonb_build_object(
  'orgId', coalesce(data->>'orgId', org_id, 'org_demo')
);

-- Promote likely admin profiles so JWT role syncs
update public.profiles
set data = data || jsonb_build_object('role', 'admin')
where coalesce(lower(data->>'role'), '') not in ('admin', 'owner', 'superadmin', 'client', 'employee')
  and (
    lower(coalesce(data->>'roleName', '')) ~ '(admin|owner|executive)'
    or lower(coalesce(data->>'departmentName', '')) like '%executive%'
  );

-- Collapse duplicate profiles sharing one auth user (keep admin / non-uuid id)
with ranked as (
  select
    id,
    row_number() over (
      partition by auth_id
      order by
        case when lower(coalesce(data->>'role', '')) in ('admin', 'owner', 'superadmin') then 0 else 1 end,
        case when id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then 1 else 0 end,
        created_at asc nulls last
    ) as rn
  from public.profiles
  where auth_id is not null
)
delete from public.profiles p
using ranked r
where p.id = r.id and r.rn > 1;

drop index if exists profiles_auth_id_uidx;
create unique index profiles_auth_id_uidx on public.profiles (auth_id)
  where auth_id is not null;

-- Employee directory is sourced only from Firebase /employees (not Auth/profiles).

-- Refresh JWT app_metadata from remaining profiles
update public.profiles
set data = data || '{}'::jsonb;


-- ======================================================================
-- 00004_project_task_notifications.sql
-- ======================================================================
-- Fan out browser-inbox rows when an employee creates a project or changes task status.

create or replace function public.humanize_task_status(status text)
returns text
language sql
immutable
as $$
  select case lower(coalesce(status, ''))
    when 'todo' then 'To Do'
    when 'in_progress' then 'In Progress'
    when 'in_review' then 'In Review'
    when 'done' then 'Done'
    when '' then 'Unknown'
    else initcap(replace(status, '_', ' '))
  end;
$$;

create or replace function public.collect_admin_identity_ids()
returns table(user_id text)
language sql
security definer
set search_path = public
as $$
  select distinct uid
  from (
    select p.id as uid
    from public.profiles p
    where lower(coalesce(p.data->>'role', '')) in ('admin', 'owner', 'superadmin')
    union
    select p.auth_id::text
    from public.profiles p
    where p.auth_id is not null
      and lower(coalesce(p.data->>'role', '')) in ('admin', 'owner', 'superadmin')
    union
    select nullif(p.data->>'uid', '')
    from public.profiles p
    where lower(coalesce(p.data->>'role', '')) in ('admin', 'owner', 'superadmin')
    union
    select nullif(p.user_id, '')
    from public.profiles p
    where lower(coalesce(p.data->>'role', '')) in ('admin', 'owner', 'superadmin')
  ) s
  where uid is not null and uid <> '';
$$;

create or replace function public.expand_person_ids(seed text[])
returns table(user_id text)
language sql
security definer
set search_path = public
as $$
  with seeds as (
    select distinct unnest(coalesce(seed, '{}'::text[])) as sid
  )
  select distinct x.uid
  from seeds s
  left join public.employees e
    on e.id = s.sid
    or coalesce(e.user_id, '') = s.sid
    or coalesce(e.data->>'uid', '') = s.sid
    or coalesce(e.data->>'employeeId', '') = s.sid
    or coalesce(e.auth_id::text, '') = s.sid
  left join public.profiles p
    on p.id = s.sid
    or coalesce(p.auth_id::text, '') = s.sid
    or coalesce(p.data->>'uid', '') = s.sid
    or coalesce(p.user_id, '') = s.sid
  cross join lateral (
    select s.sid as uid
    union select e.id
    union select e.user_id
    union select e.data->>'uid'
    union select e.data->>'employeeId'
    union select e.auth_id::text
    union select p.id
    union select p.user_id
    union select p.data->>'uid'
    union select p.auth_id::text
  ) x
  where coalesce(s.sid, '') <> ''
    and x.uid is not null
    and x.uid <> '';
$$;

create or replace function public.collect_project_member_ids(project_data jsonb)
returns table(user_id text)
language sql
security definer
set search_path = public
as $$
  with raw as (
    select m->>'uid' as uid
    from jsonb_array_elements(
      case when jsonb_typeof(project_data->'members') = 'array' then project_data->'members' else '[]'::jsonb end
    ) m
    union
    select m->>'id'
    from jsonb_array_elements(
      case when jsonb_typeof(project_data->'members') = 'array' then project_data->'members' else '[]'::jsonb end
    ) m
    union
    select m->>'employeeId'
    from jsonb_array_elements(
      case when jsonb_typeof(project_data->'members') = 'array' then project_data->'members' else '[]'::jsonb end
    ) m
    union
    select case
      when jsonb_typeof(elem) = 'string' then elem #>> '{}'
      else coalesce(elem->>'uid', elem->>'id', elem->>'employeeId')
    end
    from jsonb_array_elements(
      case
        when jsonb_typeof(project_data->'assignedEmployeeIds') = 'array' then project_data->'assignedEmployeeIds'
        else '[]'::jsonb
      end
    ) elem
    union
    select project_data->>'employeeId'
    union
    select project_data->>'createdBy'
    union
    select project_data->>'assignedTo'
    union
    select project_data->'assignedTo'->>'uid'
    union
    select project_data->'assignedTo'->>'id'
  )
  select distinct uid
  from raw
  where uid is not null and uid <> '';
$$;

create or replace function public.insert_inbox_notification(p_user_id text, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_user_id = '' then
    return;
  end if;
  insert into public.notification_items (id, user_id, data)
  values (gen_random_uuid()::text, p_user_id, p_data);
end;
$$;

create or replace function public.notify_admins_on_employee_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recip text;
  creator_name text;
  project_name text;
  payload jsonb;
begin
  if lower(coalesce(new.data->>'createdByRole', '')) is distinct from 'employee' then
    return new;
  end if;

  creator_name := coalesce(nullif(new.data->>'createdByName', ''), 'An employee');
  project_name := coalesce(nullif(new.data->>'name', ''), 'a project');
  payload := jsonb_build_object(
    'title', 'New project created',
    'message', concat(creator_name, ' created "', project_name, '"'),
    'type', 'project',
    'isRead', false,
    'projectId', new.id,
    'link', '/projects/list',
    'adminLink', '/projects/list',
    'tag', concat('project-created-', new.id),
    'createdAt', now()::text
  );

  for recip in
    select a.user_id
    from public.collect_admin_identity_ids() a
  loop
    perform public.insert_inbox_notification(recip, payload);
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_project_created_notify on public.projects;
create trigger trg_project_created_notify
  after insert on public.projects
  for each row execute function public.notify_admins_on_employee_project();

create or replace function public.notify_on_employee_task_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recip text;
  actor_ids text[];
  proj record;
  project_name text;
  task_name text;
  actor_name text;
  old_label text;
  new_label text;
  payload jsonb;
  seed text[];
begin
  if coalesce(old.data->>'status', '') is not distinct from coalesce(new.data->>'status', '') then
    return new;
  end if;
  if lower(coalesce(new.data->>'statusChangedByRole', '')) is distinct from 'employee' then
    return new;
  end if;

  seed := array_remove(array[
    new.data->>'statusChangedBy',
    new.data->>'statusChangedByUid'
  ], null);

  if jsonb_typeof(new.data->'statusChangedByIds') = 'array' then
    seed := seed || array(
      select jsonb_array_elements_text(new.data->'statusChangedByIds')
    );
  end if;

  select array_agg(e.user_id) into actor_ids
  from public.expand_person_ids(seed) e;

  actor_ids := coalesce(actor_ids, '{}'::text[]);

  select * into proj
  from public.projects
  where id = coalesce(new.data->>'projectId', '')
     or data->>'projectId' = coalesce(new.data->>'projectId', '')
  limit 1;

  project_name := coalesce(
    nullif(new.data->>'projectName', ''),
    nullif(proj.data->>'name', ''),
    'a project'
  );
  task_name := coalesce(nullif(new.data->>'title', ''), nullif(new.data->>'name', ''), 'a task');
  actor_name := coalesce(nullif(new.data->>'statusChangedByName', ''), 'An employee');
  old_label := public.humanize_task_status(old.data->>'status');
  new_label := public.humanize_task_status(new.data->>'status');

  payload := jsonb_build_object(
    'title', 'Task status updated',
    'message', concat(
      actor_name, ' moved "', task_name, '" from ', old_label, ' to ', new_label,
      ' on "', project_name, '"'
    ),
    'type', 'task',
    'isRead', false,
    'taskId', new.id,
    'projectId', coalesce(new.data->>'projectId', proj.id),
    'link', '/tasks',
    'adminLink', '/projects/tasks',
    'tag', concat('task-status-', new.id, '-', coalesce(new.data->>'status', '')),
    'createdAt', now()::text
  );

  for recip in
    select distinct r.user_id
    from (
      select m.user_id
      from public.expand_person_ids(
        array(
          select c.user_id
          from public.collect_project_member_ids(coalesce(proj.data, '{}'::jsonb)) c
        )
      ) m
      union
      select a.user_id from public.collect_admin_identity_ids() a
    ) r
    where r.user_id is not null
      and r.user_id <> ''
      and not (r.user_id = any (actor_ids))
  loop
    perform public.insert_inbox_notification(recip, payload);
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_task_status_notify on public.tasks;
create trigger trg_task_status_notify
  after update on public.tasks
  for each row execute function public.notify_on_employee_task_status();


-- ======================================================================
-- 00005_project_assignment_browser_alerts.sql
-- ======================================================================
-- Task status â†’ admins + assigned employees.
-- Employee-created projects â†’ admins.
-- Newly assigned project members â†’ those employees.

create or replace function public.collect_admin_identity_ids()
returns table(user_id text)
language sql
security definer
set search_path = public
as $$
  select distinct uid
  from (
    select p.id as uid
    from public.profiles p
    where lower(coalesce(p.data->>'role', '')) in ('admin', 'owner', 'superadmin')
    union
    select p.auth_id::text
    from public.profiles p
    where p.auth_id is not null
      and lower(coalesce(p.data->>'role', '')) in ('admin', 'owner', 'superadmin')
    union
    select nullif(p.data->>'uid', '')
    from public.profiles p
    where lower(coalesce(p.data->>'role', '')) in ('admin', 'owner', 'superadmin')
    union
    select nullif(p.user_id, '')
    from public.profiles p
    where lower(coalesce(p.data->>'role', '')) in ('admin', 'owner', 'superadmin')
    union
    select e.id
    from public.employees e
    where lower(coalesce(e.data->>'role', '')) in ('admin', 'owner', 'superadmin')
    union
    select nullif(e.user_id, '')
    from public.employees e
    where lower(coalesce(e.data->>'role', '')) in ('admin', 'owner', 'superadmin')
    union
    select e.auth_id::text
    from public.employees e
    where e.auth_id is not null
      and lower(coalesce(e.data->>'role', '')) in ('admin', 'owner', 'superadmin')
    union
    select nullif(e.data->>'uid', '')
    from public.employees e
    where lower(coalesce(e.data->>'role', '')) in ('admin', 'owner', 'superadmin')
  ) s
  where uid is not null and uid <> '';
$$;

create or replace function public.collect_task_assignee_ids(task_data jsonb)
returns table(user_id text)
language sql
security definer
set search_path = public
as $$
  with raw as (
    select task_data->>'assigneeId' as uid
    union select task_data->>'employeeId'
    union select task_data->>'createdBy'
    union select task_data->>'assignedTo'
    union select task_data->'assignedTo'->>'uid'
    union select task_data->'assignedTo'->>'id'
    union select task_data->'assignedTo'->>'employeeId'
  )
  select distinct uid
  from raw
  where uid is not null and uid <> '';
$$;

create or replace function public.text_array_from_ids(seed text[])
returns text[]
language sql
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct e.user_id), '{}'::text[])
  from public.expand_person_ids(seed) e
  where e.user_id is not null and e.user_id <> '';
$$;

create or replace function public.notify_admins_on_employee_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recip text;
  creator_name text;
  project_name text;
  payload jsonb;
  creator_ids text[];
  assigned_ids text[];
  skip_ids text[];
begin
  creator_ids := public.text_array_from_ids(array_remove(array[
    new.data->>'createdBy',
    new.data->>'createdByUid'
  ], null));

  assigned_ids := public.text_array_from_ids(array(
    select c.user_id
    from public.collect_project_member_ids(coalesce(new.data, '{}'::jsonb)) c
  ));

  project_name := coalesce(nullif(new.data->>'name', ''), 'a project');
  creator_name := coalesce(nullif(new.data->>'createdByName', ''), 'An employee');

  if lower(coalesce(new.data->>'createdByRole', '')) = 'employee' then
    payload := jsonb_build_object(
      'title', 'New project created',
      'message', concat(creator_name, ' created "', project_name, '"'),
      'type', 'project',
      'isRead', false,
      'projectId', new.id,
      'link', '/projects/list',
      'adminLink', '/projects/list',
      'tag', concat('project-created-', new.id),
      'createdAt', now()::text
    );

    skip_ids := creator_ids;
    for recip in
      select a.user_id
      from public.collect_admin_identity_ids() a
      where a.user_id is not null
        and a.user_id <> ''
        and not (a.user_id = any (skip_ids))
    loop
      perform public.insert_inbox_notification(recip, payload);
    end loop;
  end if;

  return new;
end;
$$;

create or replace function public.notify_on_project_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recip text;
  project_name text;
  actor_name text;
  payload jsonb;
  old_ids text[];
  new_ids text[];
  added_ids text[];
  creator_ids text[];
begin
  old_ids := '{}'::text[];
  if tg_op = 'UPDATE' then
    old_ids := public.text_array_from_ids(array(
      select c.user_id
      from public.collect_project_member_ids(coalesce(old.data, '{}'::jsonb)) c
    ));
  end if;

  new_ids := public.text_array_from_ids(array(
    select c.user_id
    from public.collect_project_member_ids(coalesce(new.data, '{}'::jsonb)) c
  ));

  creator_ids := public.text_array_from_ids(array_remove(array[
    new.data->>'createdBy',
    new.data->>'createdByUid'
  ], null));

  select coalesce(array_agg(x), '{}'::text[])
  into added_ids
  from (
    select unnest(new_ids) as x
    except
    select unnest(old_ids)
    except
    select unnest(creator_ids)
  ) s;

  if added_ids is null or array_length(added_ids, 1) is null then
    return new;
  end if;

  project_name := coalesce(nullif(new.data->>'name', ''), 'a project');
  actor_name := coalesce(
    nullif(new.data->>'createdByName', ''),
    nullif(new.data->>'ownerName', ''),
    'Your team'
  );
  payload := jsonb_build_object(
    'title', 'Assigned to a project',
    'message', concat('You were assigned to "', project_name, '"'),
    'type', 'project',
    'isRead', false,
    'projectId', new.id,
    'link', '/projects/list',
    'adminLink', '/projects/list',
    'tag', concat('project-assigned-', new.id, '-', extract(epoch from now())::bigint),
    'createdAt', now()::text,
    'actorName', actor_name
  );

  for recip in
    select distinct unnest(added_ids) as user_id
  loop
    perform public.insert_inbox_notification(recip, payload);
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_project_assigned_notify on public.projects;
create trigger trg_project_assigned_notify
  after insert or update on public.projects
  for each row execute function public.notify_on_project_assignment();

create or replace function public.notify_on_employee_task_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  recip text;
  actor_ids text[];
  proj record;
  project_name text;
  task_name text;
  actor_name text;
  old_label text;
  new_label text;
  payload jsonb;
  seed text[];
begin
  if coalesce(old.data->>'status', '') is not distinct from coalesce(new.data->>'status', '') then
    return new;
  end if;
  if lower(coalesce(new.data->>'statusChangedByRole', '')) is distinct from 'employee' then
    return new;
  end if;

  seed := array_remove(array[
    new.data->>'statusChangedBy',
    new.data->>'statusChangedByUid'
  ], null);

  if jsonb_typeof(new.data->'statusChangedByIds') = 'array' then
    seed := seed || array(
      select coalesce(nullif(elem #>> '{}', ''), elem->>'uid', elem->>'id')
      from jsonb_array_elements(new.data->'statusChangedByIds') elem
      where coalesce(nullif(elem #>> '{}', ''), elem->>'uid', elem->>'id') is not null
    );
  end if;

  actor_ids := public.text_array_from_ids(seed);

  select * into proj
  from public.projects
  where id = coalesce(new.data->>'projectId', '')
     or data->>'projectId' = coalesce(new.data->>'projectId', '')
  limit 1;

  project_name := coalesce(
    nullif(new.data->>'projectName', ''),
    nullif(proj.data->>'name', ''),
    'a project'
  );
  task_name := coalesce(nullif(new.data->>'title', ''), nullif(new.data->>'name', ''), 'a task');
  actor_name := coalesce(nullif(new.data->>'statusChangedByName', ''), 'An employee');
  old_label := public.humanize_task_status(old.data->>'status');
  new_label := public.humanize_task_status(new.data->>'status');

  payload := jsonb_build_object(
    'title', 'Task status updated',
    'message', concat(
      actor_name, ' moved "', task_name, '" from ', old_label, ' to ', new_label,
      ' on "', project_name, '"'
    ),
    'type', 'task',
    'isRead', false,
    'taskId', new.id,
    'projectId', coalesce(new.data->>'projectId', proj.id),
    'link', '/projects/tasks',
    'adminLink', '/projects/tasks',
    'tag', concat('task-status-', new.id, '-', coalesce(new.data->>'status', '')),
    'createdAt', now()::text
  );

  for recip in
    select distinct r.user_id
    from (
      select m.user_id
      from public.expand_person_ids(
        array(
          select c.user_id
          from public.collect_project_member_ids(coalesce(proj.data, '{}'::jsonb)) c
        )
      ) m
      union
      select a.user_id
      from public.expand_person_ids(
        array(
          select t.user_id
          from public.collect_task_assignee_ids(coalesce(new.data, '{}'::jsonb)) t
        )
      ) a
      union
      select ad.user_id from public.collect_admin_identity_ids() ad
    ) r
    where r.user_id is not null
      and r.user_id <> ''
      and not (r.user_id = any (actor_ids))
  loop
    perform public.insert_inbox_notification(recip, payload);
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_task_status_notify on public.tasks;
create trigger trg_task_status_notify
  after update on public.tasks
  for each row execute function public.notify_on_employee_task_status();


-- ======================================================================
-- 00006_claims_and_sensitive_data_rls.sql
-- ======================================================================
-- Fix application role resolution, guarantee a non-null org_id, and restrict
-- per-person tables (payslips, documents, inbox, reports, goals) to owner+admin.

-- Supabase puts a top-level `role` claim ('anon' | 'authenticated') in every JWT.
-- The original coalesce order let that shadow the application role that
-- sync_profile_claims() writes into app_metadata, so is_admin() was always false.
create or replace function public.jwt_claim(key text)
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() -> 'app_metadata' ->> key,
    auth.jwt() -> 'user_metadata' ->> key,
    auth.jwt() ->> key
  );
$$;

create or replace function public.app_role()
returns text
language sql
stable
as $$
  select lower(coalesce(
    auth.jwt() -> 'app_metadata' ->> 'role',
    auth.jwt() -> 'user_metadata' ->> 'role',
    ''
  ));
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select public.app_role() in ('admin', 'owner', 'superadmin');
$$;

-- One auth user maps to several business ids across profiles/employees
-- (row id, data->>'uid', data->>'employeeId', user_id, auth_id). Ownership
-- checks have to accept any of them, because the client picks whichever id
-- collectUserIdentityIds() resolved first when it wrote the row.
create or replace function public.self_identity_ids()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct v), '{}'::text[])
  from (
    select auth.uid()::text as v
    union select public.jwt_uid()
    union select p.id from public.profiles p where p.auth_id = auth.uid()
    union select p.user_id from public.profiles p where p.auth_id = auth.uid()
    union select p.data->>'uid' from public.profiles p where p.auth_id = auth.uid()
    union select p.data->>'employeeId' from public.profiles p where p.auth_id = auth.uid()
    union select e.id from public.employees e where e.auth_id = auth.uid()
    union select e.user_id from public.employees e where e.auth_id = auth.uid()
    union select e.data->>'uid' from public.employees e where e.auth_id = auth.uid()
    union select e.data->>'employeeId' from public.employees e where e.auth_id = auth.uid()
    -- Rows created by createEmployee() have no auth_id, so fall back to email.
    union select e.id from public.employees e
      where nullif(lower(e.data->>'email'), '') = lower(auth.jwt() ->> 'email')
    union select e.user_id from public.employees e
      where nullif(lower(e.data->>'email'), '') = lower(auth.jwt() ->> 'email')
    union select e.data->>'uid' from public.employees e
      where nullif(lower(e.data->>'email'), '') = lower(auth.jwt() ->> 'email')
    union select p.id from public.profiles p
      where nullif(lower(p.data->>'email'), '') = lower(auth.jwt() ->> 'email')
    union select p.data->>'uid' from public.profiles p
      where nullif(lower(p.data->>'email'), '') = lower(auth.jwt() ->> 'email')
  ) s
  where v is not null and v <> '';
$$;

create or replace function public.owns_row(row_user_id text)
returns boolean
language sql
stable
as $$
  select
    row_user_id is not null
    and row_user_id <> ''
    and (
      row_user_id = public.jwt_uid()
      or row_user_id = any (public.self_identity_ids())
    );
$$;

-- The compat layer leaves org_id null whenever the payload carries no orgId,
-- and can_access_row() treats a null org_id as "visible to everyone".
-- Default it at write time so org scoping actually has something to compare.
create or replace function public.default_org_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.org_id is null or new.org_id = '' then
    new.org_id := coalesce(
      nullif(new.data->>'orgId', ''),
      nullif(public.jwt_claim('orgId'), ''),
      'org_demo'
    );
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
  tables text[] := array[
    'profiles','employees','organizations','org_members','leads','org_notifications',
    'invoices','health_scores','crm_stages','projects','project_process_steps','project_timeline',
    'tasks','task_statuses','expenses','expense_categories','retainers','company_settings',
    'client_onboarding','deliverables','client_documents','document_files','payslip_records',
    'attendance','attendance_logs','work_timeline_entries','leave_requests','departments',
    'company_calendar','company_holidays','company_policies','employee_monthly_reports',
    'announcements','notification_items','help_desk_tickets','goal_items','knowledge',
    'knowledge_articles','kpi_definitions','workflows','workflow_runs','project_notes','app_docs'
  ];
begin
  foreach t in array tables loop
    execute format('drop trigger if exists trg_default_org_id on public.%I', t);
    execute format(
      'create trigger trg_default_org_id before insert or update on public.%I
         for each row execute function public.default_org_id()', t
    );
  end loop;
end $$;

update public.employees
set org_id = coalesce(nullif(org_id, ''), data->>'orgId', 'org_demo')
where org_id is null or org_id = '';

-- can_access_row stays company-wide for shared business data (this deployment is
-- a single company, and widgets legitimately read across users), but now accepts
-- every identity alias an auth user may own.
create or replace function public.can_access_row(org_id text, user_id text)
returns boolean
language sql
stable
as $$
  select
    auth.uid() is not null
    and (
      public.is_admin()
      or user_id is null
      or public.owns_row(user_id)
      or public.same_company_org(org_id)
    );
$$;

-- Per-person tables: owner or admin only. These replace the blanket
-- can_access_row policies from 00001, which allowed any authenticated user to
-- read and write every other employee's payslips and personal documents.
do $$
declare
  t text;
  private_tables text[] := array[
    'payslip_records','document_files','notification_items',
    'employee_monthly_reports','goal_items'
  ];
begin
  foreach t in array private_tables loop
    execute format('drop policy if exists %I on public.%I', t||'_select', t);
    execute format('drop policy if exists %I on public.%I', t||'_write', t);
    execute format('drop policy if exists %I on public.%I', t||'_owner', t);
    execute format(
      'create policy %I on public.%I for all to authenticated
         using (public.is_admin() or public.owns_row(user_id))
         with check (public.is_admin() or public.owns_row(user_id))',
      t||'_owner', t
    );
  end loop;
end $$;

-- 00003 scopes employee writes to `user_id = jwt_uid()`, which misses the
-- identity aliases above; widen it so staff can still edit their own row.
drop policy if exists employees_write on public.employees;
create policy employees_write on public.employees
  for all to authenticated
  using (public.is_admin() or public.owns_row(user_id))
  with check (public.is_admin() or public.owns_row(user_id));


-- ======================================================================
-- 00007_private_document_buckets.sql
-- ======================================================================
-- Employee documents and payslips were served from public buckets, so any
-- unauthenticated caller holding the URL could read them. Make those two
-- private and scope objects to the owning folder. `deliverables` stays public
-- because those links are deliberately shared with clients.

update storage.buckets set public = false where id in ('employees', 'payslips');
update storage.buckets set public = true where id = 'deliverables';

drop policy if exists storage_auth_read on storage.objects;
drop policy if exists storage_auth_write on storage.objects;
drop policy if exists storage_deliverables on storage.objects;
drop policy if exists storage_employees_owner on storage.objects;
drop policy if exists storage_payslips_owner on storage.objects;

create policy storage_deliverables on storage.objects
  for all to authenticated
  using (bucket_id = 'deliverables')
  with check (bucket_id = 'deliverables');

-- Paths are `employees/{uid}/documents/{filename}`, so foldername()[1] is the
-- owning business id. Admins retain full access for the document manager.
create policy storage_employees_owner on storage.objects
  for all to authenticated
  using (
    bucket_id = 'employees'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = any (public.self_identity_ids())
    )
  )
  with check (
    bucket_id = 'employees'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = any (public.self_identity_ids())
    )
  );

create policy storage_payslips_owner on storage.objects
  for all to authenticated
  using (
    bucket_id = 'payslips'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = any (public.self_identity_ids())
    )
  )
  with check (
    bucket_id = 'payslips'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = any (public.self_identity_ids())
    )
  );

commit;

