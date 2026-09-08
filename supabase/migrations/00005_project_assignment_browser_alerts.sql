-- Task status → admins + assigned employees.
-- Employee-created projects → admins.
-- Newly assigned project members → those employees.

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
