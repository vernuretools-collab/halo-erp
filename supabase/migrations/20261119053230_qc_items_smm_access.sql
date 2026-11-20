-- An SMM mark was rejected because qc_items only allowed an admin to write a
-- status other than In Review, and the insert check depended on a staff role
-- that does not know the Editor and SMM checkboxes. Editors can read. An SMM,
-- a reviewer, leadership, or an admin can create a review.

create or replace function public.qc_has_flag(p_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees e
    where (e.data -> p_key) = 'true'::jsonb
      and (
        e.auth_id = auth.uid()
        or e.id = any (public.self_identity_ids())
        or coalesce(e.user_id, '') = any (public.self_identity_ids())
        or coalesce(e.data->>'uid', '') = any (public.self_identity_ids())
        or coalesce(e.data->>'employeeId', '') = any (public.self_identity_ids())
        or (
          nullif(lower(e.data->>'email'), '') is not null
          and nullif(lower(e.data->>'email'), '') = lower(coalesce(auth.jwt() ->> 'email', ''))
        )
      )
  );
$$;

create or replace function public.qc_can_read()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      public.self_is_admin()
      or public.reel_is_leadership()
      or public.qc_has_flag('qcEditor')
      or public.qc_has_flag('qcSmm')
    );
$$;

create or replace function public.qc_can_create()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    auth.uid() is not null
    and (
      public.self_is_admin()
      or public.reel_is_leadership()
      or public.qc_has_flag('qcSmm')
    );
$$;

revoke all on function public.qc_has_flag(text) from public, anon;
revoke all on function public.qc_can_read() from public, anon;
revoke all on function public.qc_can_create() from public, anon;
grant execute on function public.qc_has_flag(text) to authenticated;
grant execute on function public.qc_can_read() to authenticated;
grant execute on function public.qc_can_create() to authenticated;

drop policy if exists qc_items_select on public.qc_items;
create policy qc_items_select on public.qc_items
  for select to authenticated
  using (
    public.qc_can_read()
    or uploader_id = any (public.self_identity_ids())
    or reviewer_id = any (public.self_identity_ids())
  );

drop policy if exists qc_items_insert on public.qc_items;
create policy qc_items_insert on public.qc_items
  for insert to authenticated
  with check (
    status = 'in_review'
    and (
      public.qc_can_create()
      or public.qc_has_flag('qcEditor')
    )
  );

drop policy if exists qc_items_update on public.qc_items;
create policy qc_items_update on public.qc_items
  for update to authenticated
  using (
    public.qc_can_read()
    or uploader_id = any (public.self_identity_ids())
    or reviewer_id = any (public.self_identity_ids())
  )
  with check (
    (
      status = 'in_review'
      and (
        public.qc_can_read()
        or uploader_id = any (public.self_identity_ids())
      )
    )
    or (
      status in ('changes_requested', 'approved')
      and public.qc_can_create()
    )
  );

drop policy if exists qc_comments_staff on public.qc_comments;
create policy qc_comments_select on public.qc_comments
  for select to authenticated
  using (public.qc_can_read());

create policy qc_comments_insert on public.qc_comments
  for insert to authenticated
  with check (public.qc_can_create());

create policy qc_comments_update on public.qc_comments
  for update to authenticated
  using (public.qc_can_create())
  with check (public.qc_can_create());

create policy qc_comments_delete on public.qc_comments
  for delete to authenticated
  using (public.qc_can_create());

drop policy if exists qc_versions_staff on public.qc_versions;
create policy qc_versions_select on public.qc_versions
  for select to authenticated
  using (public.qc_can_read());

create policy qc_versions_insert on public.qc_versions
  for insert to authenticated
  with check (public.qc_can_read());

create policy qc_versions_update on public.qc_versions
  for update to authenticated
  using (public.qc_can_read())
  with check (public.qc_can_read());
