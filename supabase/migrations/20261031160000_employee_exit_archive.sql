-- Exit and archive are status fields on the existing employees row.
-- This migration does not delete or rewrite employee, attendance, timeline,
-- leave, scrum, project, task, document, onboarding, or notification rows.

create or replace function public.protect_employee_exit_fields()
returns trigger
language plpgsql
as $$
declare
  keys text[] := array['status', 'lastWorkingDay', 'exitReason', 'exitHistory', 'relievedAt', 'archivedAt'];
  key text;
begin
  if auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if new.data is null then
    new.data := '{}'::jsonb;
  end if;
  foreach key in array keys loop
    new.data := new.data - key;
    if old.data ? key then
      new.data := new.data || jsonb_build_object(key, old.data -> key);
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_protect_employee_exit_fields on public.employees;
create trigger trg_protect_employee_exit_fields
  before update on public.employees
  for each row
  execute function public.protect_employee_exit_fields();

drop policy if exists employees_select on public.employees;
create policy employees_select on public.employees
  for select to authenticated
  using (
    public.is_admin()
    or id = any (public.self_identity_ids())
    or public.owns_row(user_id)
    or auth_id = auth.uid()
    or (
      public.same_company_org(org_id)
      and lower(coalesce(nullif(data->>'status', ''), 'active')) not in ('relieved', 'archived')
    )
  );
