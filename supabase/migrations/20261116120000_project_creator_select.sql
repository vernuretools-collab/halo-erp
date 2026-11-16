-- PostgREST reads an inserted project back before self_visible_project_ids()
-- can see that row, so the select policy rolled the insert back. The creator
-- can read a row whose createdBy is already one of their identity ids.

drop policy if exists projects_select on public.projects;

create policy projects_select on public.projects
  for select to authenticated
  using (
    (select auth.uid()) is not null
    and (
      (select public.self_is_admin())
      or id = any (select unnest(public.self_visible_project_ids()))
      or coalesce(data->>'createdBy', '') = any (select unnest(public.self_identity_ids()))
    )
  );
