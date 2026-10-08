create table if not exists public.employee_onboarding (
  id text primary key,
  auth_id uuid,
  username text not null,
  status text not null default 'draft',
  employment jsonb not null default '{}'::jsonb,
  kras jsonb,
  answers jsonb not null default '{}'::jsonb,
  documents jsonb not null default '[]'::jsonb,
  org_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz
);

create unique index if not exists employee_onboarding_username_idx
  on public.employee_onboarding (lower(username));
create index if not exists employee_onboarding_auth_id_idx
  on public.employee_onboarding (auth_id);

alter table public.employee_onboarding enable row level security;

drop policy if exists employee_onboarding_admin on public.employee_onboarding;
create policy employee_onboarding_admin on public.employee_onboarding
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists employee_onboarding_self on public.employee_onboarding;
create policy employee_onboarding_self on public.employee_onboarding
  for select to authenticated
  using (auth_id = auth.uid());

drop policy if exists employee_onboarding_self_update on public.employee_onboarding;
create policy employee_onboarding_self_update on public.employee_onboarding
  for update to authenticated
  using (auth_id = auth.uid() and status <> 'submitted')
  with check (auth_id = auth.uid());

create or replace function public.save_employee_onboarding_draft(p_answers jsonb)
returns public.employee_onboarding
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.employee_onboarding;
begin
  update public.employee_onboarding
  set answers = coalesce(p_answers, '{}'::jsonb), updated_at = now()
  where auth_id = auth.uid() and status <> 'submitted'
  returning * into row;
  if not found then
    select * into row from public.employee_onboarding where auth_id = auth.uid();
  end if;
  return row;
end;
$$;

create or replace function public.submit_employee_onboarding(p_answers jsonb)
returns public.employee_onboarding
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.employee_onboarding;
begin
  update public.employee_onboarding
  set
    answers = coalesce(p_answers, answers),
    status = 'submitted',
    submitted_at = coalesce(submitted_at, now()),
    updated_at = now()
  where auth_id = auth.uid()
  returning * into row;
  if not found then
    raise exception 'No joining form is linked to this login.';
  end if;
  return row;
end;
$$;

grant execute on function public.save_employee_onboarding_draft(jsonb) to authenticated;
grant execute on function public.submit_employee_onboarding(jsonb) to authenticated;
