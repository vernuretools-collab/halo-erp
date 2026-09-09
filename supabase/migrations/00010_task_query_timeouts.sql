-- Stop GET /tasks?select=* and timeline uid filters from statement-timeout.
-- 00008's can_access_task() expanded every assignee through employees/profiles
-- and then called can_access_project_id(), which scanned tasks again per row.

create or replace function public.task_person_ids(task_data jsonb)
returns text[]
language sql
immutable
as $$
  select coalesce(array_remove(array[
    nullif(task_data->>'assigneeId', ''),
    nullif(task_data->>'employeeId', ''),
    nullif(task_data->>'createdBy', ''),
    nullif(task_data->>'assignedTo', ''),
    nullif(task_data->'assignedTo'->>'uid', ''),
    nullif(task_data->'assignedTo'->>'id', ''),
    nullif(task_data->'assignedTo'->>'employeeId', '')
  ], null), '{}'::text[]);
$$;

-- Membership / creator / client only. No nested scan of public.tasks.
create or replace function public.can_access_project_membership(row_id text, row_data jsonb)
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
        from public.collect_project_member_ids(coalesce(row_data, '{}'::jsonb)) m
        where m.user_id = any (public.self_identity_ids())
      )
      or (
        public.self_role() = 'client'
        and coalesce(row_data->>'clientId', '') <> ''
        and row_data->>'clientId' = any (public.self_identity_ids())
      )
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
      or public.task_person_ids(coalesce(row_data, '{}'::jsonb)) && public.self_identity_ids()
      or exists (
        select 1
        from public.projects p
        where p.id = coalesce(row_data->>'projectId', '')
          and public.can_access_project_membership(p.id, p.data)
      )
    );
$$;

create index if not exists work_timeline_entries_uid_idx
  on public.work_timeline_entries ((data->>'uid'));
create index if not exists work_timeline_entries_date_idx
  on public.work_timeline_entries ((data->>'date'));
create index if not exists tasks_assignee_idx
  on public.tasks ((data->>'assigneeId'));
create index if not exists tasks_created_by_idx
  on public.tasks ((data->>'createdBy'));
create index if not exists employees_email_lower_idx
  on public.employees ((lower(data->>'email')));
create index if not exists profiles_email_lower_idx
  on public.profiles ((lower(data->>'email')));
