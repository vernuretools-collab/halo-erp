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
