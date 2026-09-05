-- JSON document tables + RLS + realtime + storage buckets + business triggers

create extension if not exists "pgcrypto";

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
    execute format('
      create table if not exists public.%I (
        id text primary key,
        org_id text,
        user_id text,
        parent_id text,
        collection_name text,
        auth_id uuid,
        data jsonb not null default ''{}''::jsonb,
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )', t);
    execute format('create index if not exists %I_org_idx on public.%I (org_id)', t||'_org', t);
    execute format('create index if not exists %I_user_idx on public.%I (user_id)', t||'_user', t);
    execute format('create index if not exists %I_parent_idx on public.%I (parent_id)', t||'_parent', t);
    execute format('create index if not exists %I_data_gin on public.%I using gin (data)', t||'_data', t);
    execute format('alter table public.%I replica identity full', t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

create index if not exists profiles_auth_id_idx on public.profiles (auth_id);
create index if not exists app_docs_collection_idx on public.app_docs (collection_name);

create or replace function public.jwt_claim(key text)
returns text
language sql
stable
as $$
  select coalesce(
    auth.jwt() ->> key,
    auth.jwt() -> 'app_metadata' ->> key,
    auth.jwt() -> 'user_metadata' ->> key
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(public.jwt_claim('role'), '')) in ('admin', 'owner', 'superadmin');
$$;

create or replace function public.jwt_uid()
returns text
language sql
stable
as $$
  select coalesce(public.jwt_claim('business_uid'), auth.uid()::text);
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
      or org_id is null
      or org_id = public.jwt_claim('orgId')
    );
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','employees','organizations','org_members','leads','org_notifications',
    'invoices','health_scores','crm_stages','projects','project_process_steps','project_timeline',
    'tasks','task_statuses','expenses','expense_categories','retainers','company_settings',
    'client_onboarding','deliverables','client_documents','document_files','payslip_records',
    'attendance','attendance_logs','work_timeline_entries','leave_requests','departments',
    'company_calendar','company_holidays','company_policies','employee_monthly_reports',
    'announcements','notification_items','help_desk_tickets','goal_items','knowledge',
    'knowledge_articles','kpi_definitions','workflows','workflow_runs','project_notes','app_docs'
  ] loop
    execute format('drop policy if exists %I on public.%I', t||'_select', t);
    execute format('drop policy if exists %I on public.%I', t||'_write', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.can_access_row(org_id, user_id) or public.is_admin())',
      t||'_select', t
    );
    execute format(
      'create policy %I on public.%I for all to authenticated using (public.can_access_row(org_id, user_id) or public.is_admin()) with check (public.can_access_row(org_id, user_id) or public.is_admin())',
      t||'_write', t
    );
  end loop;
end $$;

-- Own profile readable by owner even before claims exist
drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for all to authenticated
  using (auth_id = auth.uid() or id = public.jwt_uid() or public.is_admin())
  with check (auth_id = auth.uid() or id = public.jwt_uid() or public.is_admin());

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, auth_id, data)
  values (
    new.id::text,
    new.id,
    jsonb_build_object(
      'uid', new.id::text,
      'email', new.email,
      'displayName', coalesce(new.raw_user_meta_data->>'displayName', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      'photoURL', new.raw_user_meta_data->>'avatar_url',
      'status', 'active',
      'fcmTokens', '[]'::jsonb,
      'createdAt', now(),
      'updatedAt', now()
    )
  )
  on conflict (id) do update
    set auth_id = excluded.auth_id,
        data = public.profiles.data || jsonb_build_object('lastSeenAt', now());
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();

create or replace function public.sync_profile_claims()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
begin
  target := coalesce(new.auth_id, case when new.id ~* '^[0-9a-f-]{36}$' then new.id::uuid else null end);
  if target is null then
    return new;
  end if;
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object(
    'role', coalesce(new.data->>'role', 'employee'),
    'tier', coalesce(new.data->>'tier', 'company'),
    'orgId', coalesce(new.data->>'orgId', new.org_id, 'org_demo'),
    'business_uid', new.id
  )
  where id = target;
  return new;
end;
$$;

drop trigger if exists on_profile_claims on public.profiles;
create trigger on_profile_claims
  after insert or update of data, org_id, auth_id on public.profiles
  for each row execute function public.sync_profile_claims();

create or replace function public.on_lead_won()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(old.data->>'pipelineStageId','') is distinct from 'stage_won'
     and new.data->>'pipelineStageId' = 'stage_won' then
    insert into public.org_notifications (id, org_id, data)
    values (
      gen_random_uuid()::text,
      new.org_id,
      jsonb_build_object(
        'title', 'Deal Won!',
        'message', concat('Opportunity "', coalesce(new.data->>'name','lead'), '" was won'),
        'type', 'crm',
        'isRead', false,
        'recipientId', coalesce(new.data->>'ownerId', 'admin'),
        'createdAt', now()
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_lead_won on public.leads;
create trigger trg_lead_won
  after update on public.leads
  for each row execute function public.on_lead_won();

create or replace function public.fanout_announcement()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  emp record;
begin
  for emp in
    select id from public.employees
    where coalesce(data->>'status','active') not in ('inactive','terminated')
  loop
    insert into public.notification_items (id, user_id, data)
    values (
      gen_random_uuid()::text,
      emp.id,
      jsonb_build_object(
        'title', concat('📢 ', coalesce(new.data->>'title','New Announcement')),
        'message', left(coalesce(new.data->>'body',''), 120),
        'type', 'announcement',
        'isRead', false,
        'announcementId', new.id,
        'link', '/announcements',
        'createdAt', now()::text
      )
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists trg_announcement_fanout on public.announcements;
create trigger trg_announcement_fanout
  after insert on public.announcements
  for each row execute function public.fanout_announcement();

create or replace function public.purge_announcement_inbox()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.notification_items
  where data->>'announcementId' = old.id;
  return old;
end;
$$;

drop trigger if exists trg_announcement_purge on public.announcements;
create trigger trg_announcement_purge
  after delete on public.announcements
  for each row execute function public.purge_announcement_inbox();

create or replace function public.aggregate_health_scores()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  org record;
  pipeline numeric;
  invoiced numeric;
  score int;
begin
  for org in select id from public.organizations loop
    select coalesce(sum((data->>'estimatedValue')::numeric), 0) into pipeline
      from public.leads where org_id = org.id;
    select coalesce(sum((data->>'total')::numeric), 0) into invoiced
      from public.invoices where org_id = org.id or data->>'orgId' = org.id;
    score := least(100, greatest(50, round((pipeline + invoiced) / 5000.0)));
    insert into public.health_scores (id, org_id, data)
    values (
      gen_random_uuid()::text,
      org.id,
      jsonb_build_object(
        'overallScore', score,
        'calculatedAt', now(),
        'breakdown', jsonb_build_object(
          'crm', jsonb_build_object('score', 95),
          'finance', jsonb_build_object('score', 88),
          'projects', jsonb_build_object('score', 94),
          'team', jsonb_build_object('score', 91)
        )
      )
    );
  end loop;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'profiles','employees','organizations','org_members','leads','org_notifications',
    'invoices','health_scores','projects','tasks','attendance','attendance_logs',
    'work_timeline_entries','leave_requests','announcements','notification_items',
    'help_desk_tickets','document_files','payslip_records','deliverables','goal_items'
  ] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then
      null;
    when undefined_object then
      null;
    end;
  end loop;
end $$;

insert into storage.buckets (id, name, public)
values
  ('employees', 'employees', true),
  ('deliverables', 'deliverables', true),
  ('payslips', 'payslips', true)
on conflict (id) do nothing;

drop policy if exists storage_auth_read on storage.objects;
drop policy if exists storage_auth_write on storage.objects;
create policy storage_auth_read on storage.objects
  for select to authenticated
  using (bucket_id in ('employees','deliverables','payslips'));
create policy storage_auth_write on storage.objects
  for all to authenticated
  using (bucket_id in ('employees','deliverables','payslips'))
  with check (bucket_id in ('employees','deliverables','payslips'));
