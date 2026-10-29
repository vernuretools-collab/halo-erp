-- Joining setup that was saved only on profiles belongs in employee_onboarding.
-- Existing table rows stay as they are. This does not touch the employee directory.

insert into public.employee_onboarding (
  id,
  org_id,
  auth_id,
  username,
  status,
  employment,
  kras,
  answers,
  documents,
  login_password,
  submitted_at,
  updated_at
)
select
  p.auth_id,
  coalesce(nullif(p.org_id, ''), nullif(p.data->>'orgId', ''), 'org_demo'),
  p.auth_id,
  lower(btrim(p.data->>'username')),
  case
    when p.data->>'joiningStatus' = 'submitted' then 'submitted'
    else 'awaiting_answers'
  end,
  case
    when jsonb_typeof(p.data->'employment') = 'object' then p.data->'employment'
    else '{}'::jsonb
  end,
  case
    when jsonb_typeof(p.data->'kras') = 'object' then p.data->'kras'
    else '{}'::jsonb
  end,
  case
    when jsonb_typeof(p.data->'answers') = 'object' then p.data->'answers'
    else '{}'::jsonb
  end,
  case
    when jsonb_typeof(p.data->'documents') = 'array' then p.data->'documents'
    else '[]'::jsonb
  end,
  nullif(p.data->>'loginPassword', ''),
  case
    when p.data->>'joiningStatus' = 'submitted'
      and coalesce(p.data->>'submittedAt', '') ~ '^\d{4}-\d{2}-\d{2}'
      then (p.data->>'submittedAt')::timestamptz
    when p.data->>'joiningStatus' = 'submitted' then p.updated_at
    else null
  end,
  now()
from public.profiles p
where p.auth_id is not null
  and length(lower(btrim(coalesce(p.data->>'username', '')))) >= 3
  and (
    lower(coalesce(p.data->>'role', '')) = 'employee_onboarding'
    or lower(coalesce(p.data->>'email', '')) like '%@join.halo.local'
    or lower(coalesce(p.data->>'email', '')) like '%@joining.halo.local'
  )
  and (
    (jsonb_typeof(p.data->'employment') = 'object' and p.data->'employment' <> '{}'::jsonb)
    or (jsonb_typeof(p.data->'answers') = 'object' and p.data->'answers' <> '{}'::jsonb)
  )
  and not exists (
    select 1
    from public.employee_onboarding e
    where e.auth_id = p.auth_id
      or e.id = p.auth_id
      or lower(e.username) = lower(btrim(p.data->>'username'))
  );

drop policy if exists employee_onboarding_admin_all on public.employee_onboarding;
create policy employee_onboarding_admin_all
  on public.employee_onboarding
  for all
  to authenticated
  using (
    public.self_is_admin()
    and org_id = coalesce(nullif(public.jwt_claim('orgId'), ''), org_id)
  )
  with check (
    public.self_is_admin()
    and org_id = coalesce(nullif(public.jwt_claim('orgId'), ''), org_id)
  );
