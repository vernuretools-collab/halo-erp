-- work_timeline_entries still used company-wide can_access_row(), so
-- GET ...&data->>uid=eq.&data->>date=gte. scanned every row and timed out (57014).

create index if not exists work_timeline_entries_uid_date_idx
  on public.work_timeline_entries ((data->>'uid'), (data->>'date'));

drop policy if exists work_timeline_entries_select on public.work_timeline_entries;
drop policy if exists work_timeline_entries_write on public.work_timeline_entries;

create policy work_timeline_entries_select on public.work_timeline_entries
  for select to authenticated
  using (
    public.self_is_admin()
    or public.is_admin()
    or user_id = any (public.self_identity_ids())
    or (data->>'uid') = any (public.self_identity_ids())
  );

create policy work_timeline_entries_write on public.work_timeline_entries
  for all to authenticated
  using (
    public.self_is_admin()
    or public.is_admin()
    or user_id = any (public.self_identity_ids())
    or (data->>'uid') = any (public.self_identity_ids())
  )
  with check (
    public.self_is_admin()
    or public.is_admin()
    or user_id = any (public.self_identity_ids())
    or (data->>'uid') = any (public.self_identity_ids())
  );

-- Index-first lookup; RLS is not applied inside security definer, so the uid/date
-- predicate can use work_timeline_entries_uid_date_idx. Access is still checked.
create or replace function public.list_work_timeline_entries(
  p_uids text[],
  p_start text,
  p_end text
)
returns setof public.work_timeline_entries
language sql
stable
security definer
set search_path = public
as $$
  select e.*
  from public.work_timeline_entries e
  where (e.data->>'uid') = any (coalesce(p_uids, '{}'::text[]))
    and (e.data->>'date') >= coalesce(p_start, '')
    and (e.data->>'date') <= coalesce(p_end, '9999-12-31')
    and (
      public.self_is_admin()
      or public.is_admin()
      or e.user_id = any (public.self_identity_ids())
      or (e.data->>'uid') = any (public.self_identity_ids())
    )
  limit 500;
$$;

grant execute on function public.list_work_timeline_entries(text[], text, text) to authenticated;
grant execute on function public.list_work_timeline_entries(text[], text, text) to service_role;

analyze public.work_timeline_entries;

notify pgrst, 'reload schema';
