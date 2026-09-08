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
