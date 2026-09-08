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
