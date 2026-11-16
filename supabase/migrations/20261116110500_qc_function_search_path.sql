-- Pin search_path on the QC helper functions.

create or replace function public.is_qc_staff()
returns boolean
language sql
stable
set search_path = public
as $$
  select
    auth.uid() is not null
    and public.self_role() <> ''
    and public.self_role() not in ('client', 'employee_onboarding');
$$;

create or replace function public.qc_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.qc_touch_updated_at() from PUBLIC, anon, authenticated;
