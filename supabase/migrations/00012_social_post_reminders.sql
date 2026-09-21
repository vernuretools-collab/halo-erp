-- Recurring social-post upload reminders per employee.

create table if not exists public.social_post_reminder_items (
  id text primary key,
  org_id text,
  user_id text,
  parent_id text,
  collection_name text,
  auth_id uuid,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists social_post_reminder_items_org_idx
  on public.social_post_reminder_items (org_id);
create index if not exists social_post_reminder_items_user_idx
  on public.social_post_reminder_items (user_id);
create index if not exists social_post_reminder_items_parent_idx
  on public.social_post_reminder_items (parent_id);
create index if not exists social_post_reminder_items_data_gin
  on public.social_post_reminder_items using gin (data);

alter table public.social_post_reminder_items replica identity full;
alter table public.social_post_reminder_items enable row level security;

drop policy if exists social_post_reminder_items_select on public.social_post_reminder_items;
drop policy if exists social_post_reminder_items_write on public.social_post_reminder_items;

create policy social_post_reminder_items_select on public.social_post_reminder_items
  for select to authenticated
  using (public.can_access_row(org_id, user_id) or public.is_admin());

create policy social_post_reminder_items_write on public.social_post_reminder_items
  for all to authenticated
  using (public.can_access_row(org_id, user_id) or public.is_admin())
  with check (public.can_access_row(org_id, user_id) or public.is_admin());

do $$
begin
  execute 'alter publication supabase_realtime add table public.social_post_reminder_items';
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
