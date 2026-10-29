-- Joining logins are not staff. Drop directory rows created by the old
-- Setup new employee path, and mark those profiles as joining accounts.
delete from public.employees
where lower(coalesce(data->>'email', '')) like '%@join.halo.local'
   or lower(coalesce(data->>'email', '')) like '%@joining.halo.local';

update public.profiles
set
  data = jsonb_set(coalesce(data, '{}'::jsonb), '{role}', '"employee_onboarding"', true),
  updated_at = now()
where (
  lower(coalesce(data->>'email', '')) like '%@join.halo.local'
  or lower(coalesce(data->>'email', '')) like '%@joining.halo.local'
)
and lower(coalesce(data->>'role', '')) = 'employee';
