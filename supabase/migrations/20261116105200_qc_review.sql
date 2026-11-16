-- Internal QC review queue. Draft media stays in a private bucket.
-- Clients and joining accounts cannot read or write these rows.

create or replace function public.is_qc_staff()
returns boolean
language sql
stable
as $$
  select
    auth.uid() is not null
    and public.self_role() <> ''
    and public.self_role() not in ('client', 'employee_onboarding');
$$;

create table if not exists public.qc_items (
  id text primary key,
  project_id text not null,
  title text not null,
  status text not null default 'in_review'
    check (status in ('in_review', 'changes_requested', 'approved')),
  uploader_id text,
  uploader_name text,
  reviewer_id text,
  reviewer_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.qc_versions (
  id text primary key,
  item_id text not null references public.qc_items (id) on delete cascade,
  version_number integer not null check (version_number > 0),
  storage_path text not null,
  file_name text not null,
  content_type text,
  byte_size bigint,
  uploaded_by_id text,
  uploaded_by_name text,
  created_at timestamptz not null default now(),
  unique (item_id, version_number)
);

create table if not exists public.qc_comments (
  id text primary key,
  version_id text not null references public.qc_versions (id) on delete cascade,
  body text not null check (char_length(btrim(body)) > 0 and char_length(body) <= 4000),
  author_id text,
  author_name text,
  created_at timestamptz not null default now()
);

create index if not exists qc_items_project_id_idx on public.qc_items (project_id);
create index if not exists qc_items_status_idx on public.qc_items (status);
create index if not exists qc_items_updated_at_idx on public.qc_items (updated_at desc);
create index if not exists qc_versions_item_id_idx on public.qc_versions (item_id);
create index if not exists qc_comments_version_id_idx on public.qc_comments (version_id);

create or replace function public.qc_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists qc_items_touch_updated_at on public.qc_items;
create trigger qc_items_touch_updated_at
  before update on public.qc_items
  for each row execute function public.qc_touch_updated_at();

alter table public.qc_items enable row level security;
alter table public.qc_versions enable row level security;
alter table public.qc_comments enable row level security;

drop policy if exists qc_items_select on public.qc_items;
drop policy if exists qc_items_insert on public.qc_items;
drop policy if exists qc_items_update on public.qc_items;
drop policy if exists qc_items_delete on public.qc_items;

create policy qc_items_select on public.qc_items
  for select to authenticated
  using (public.is_qc_staff());

create policy qc_items_insert on public.qc_items
  for insert to authenticated
  with check (
    public.is_qc_staff()
    and (public.self_is_admin() or status = 'in_review')
  );

-- Heads approve or request changes. Everyone else can only leave a row in review,
-- which is what a new upload does after changes were requested.
create policy qc_items_update on public.qc_items
  for update to authenticated
  using (public.is_qc_staff())
  with check (
    public.is_qc_staff()
    and (public.self_is_admin() or status = 'in_review')
  );

create policy qc_items_delete on public.qc_items
  for delete to authenticated
  using (
    public.self_is_admin()
    or (
      public.is_qc_staff()
      and uploader_id = any (public.self_identity_ids())
    )
  );

revoke all on function public.qc_touch_updated_at() from PUBLIC, anon, authenticated;

drop policy if exists qc_versions_staff on public.qc_versions;
create policy qc_versions_staff on public.qc_versions
  for all to authenticated
  using (public.is_qc_staff())
  with check (public.is_qc_staff());

drop policy if exists qc_comments_staff on public.qc_comments;
create policy qc_comments_staff on public.qc_comments
  for all to authenticated
  using (public.is_qc_staff())
  with check (public.is_qc_staff());

revoke all on public.qc_items from anon;
revoke all on public.qc_versions from anon;
revoke all on public.qc_comments from anon;
grant select, insert, update, delete on public.qc_items to authenticated;
grant select, insert, update, delete on public.qc_versions to authenticated;
grant select, insert, update, delete on public.qc_comments to authenticated;

insert into storage.buckets (id, name, public, file_size_limit)
values ('qc-media', 'qc-media', false, 52428800)
on conflict (id) do update
set public = false,
    file_size_limit = 52428800;

drop policy if exists storage_qc_media_staff on storage.objects;
create policy storage_qc_media_staff on storage.objects
  for all to authenticated
  using (
    bucket_id = 'qc-media'
    and public.is_qc_staff()
  )
  with check (
    bucket_id = 'qc-media'
    and public.is_qc_staff()
  );

do $$
begin
  execute 'alter publication supabase_realtime add table public.qc_items';
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
