alter table public.employee_onboarding
  add column if not exists login_password text;
