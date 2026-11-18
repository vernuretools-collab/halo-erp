-- Client codes come from the client name. Several projects can share one client,
-- so saving that code on a second project must not abort planning.

create or replace function public.reel_client_code(p_name text)
returns text
language sql
immutable
set search_path = public
as $$
  select case
    when length(code) >= 2 then code
    else ''
  end
  from (
    select left(upper(regexp_replace(coalesce(p_name, ''), '[^A-Za-z0-9]', '', 'g')), 8) as code
  ) s;
$$;

create or replace function public.reel_next_id(p_project_id text, p_prefix text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_no integer;
  v_name text;
begin
  if auth.uid() is null or not public.is_qc_staff() then
    raise exception 'You cannot plan reels.';
  end if;
  select nullif(reel_prefix, ''), data->>'clientName'
    into v_prefix, v_name
  from public.projects
  where id = p_project_id;
  if v_prefix is null then
    v_prefix := upper(btrim(coalesce(p_prefix, '')));
  end if;
  if v_prefix is null or v_prefix !~ '^[A-Z0-9]{2,8}$' then
    v_prefix := public.reel_client_code(v_name);
  end if;
  if v_prefix is null or v_prefix !~ '^[A-Z0-9]{2,8}$' then
    return '';
  end if;
  select next_no into v_no from public.reel_sequences where prefix = v_prefix;
  return v_prefix || '-R' || lpad((coalesce(v_no, 0) + 1)::text, 3, '0');
end;
$$;

create or replace function public.reel_plan(
  p_project_id text,
  p_prefix text,
  p_title text,
  p_brief text,
  p_raw_footage_url text,
  p_editor_id text,
  p_editor_name text,
  p_reviewer_id text,
  p_reviewer_name text,
  p_golive timestamptz,
  p_platforms text[],
  p_collaborators text[],
  p_rush_reason text,
  p_smm_name text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project public.projects%rowtype;
  v_prefix text;
  v_no integer;
  v_id text;
  v_rush boolean;
  v_title text := btrim(coalesce(p_title, ''));
  v_raw text;
  v_leader text;
  v_collab text[];
  v_platforms text[];
begin
  if not public.reel_can_plan() then
    raise exception 'Only an SMM or leadership can plan a reel.';
  end if;
  if v_title = '' then
    raise exception 'Add a title.';
  end if;
  if p_golive is null then
    raise exception 'A reel cannot be created without a go-live date.';
  end if;
  if btrim(coalesce(p_editor_id, '')) = '' then
    raise exception 'Choose an editor.';
  end if;
  v_raw := public.reel_require_url(p_raw_footage_url, 'Add the raw footage link.');

  select coalesce(array_agg(distinct platform), '{}')
  into v_platforms
  from (
    select nullif(btrim(x), '') as platform
    from unnest(coalesce(p_platforms, '{}')) as x
  ) s
  where platform is not null;
  if coalesce(array_length(v_platforms, 1), 0) = 0 then
    raise exception 'Add the platforms.';
  end if;

  select * into v_project from public.projects where id = p_project_id;
  if not found then
    raise exception 'Choose a client project.';
  end if;
  if not public.reel_is_leadership() and not public.can_access_project(v_project.id, v_project.data) then
    raise exception 'You cannot plan reels for this client.';
  end if;

  v_prefix := nullif(v_project.reel_prefix, '');
  if v_prefix is null then
    v_prefix := upper(btrim(coalesce(p_prefix, '')));
  end if;
  if v_prefix is null or v_prefix !~ '^[A-Z0-9]{2,8}$' then
    v_prefix := public.reel_client_code(v_project.data->>'clientName');
  end if;
  if v_prefix is null or v_prefix !~ '^[A-Z0-9]{2,8}$' then
    raise exception 'This client name is too short to make a client code.';
  end if;

  v_rush := p_golive < now() + interval '72 hours';
  if v_rush and btrim(coalesce(p_rush_reason, '')) = '' then
    raise exception 'This go-live is under 72 hours away. Add a Rush reason.';
  end if;

  select coalesce(array_agg(distinct handle), '{}')
  into v_collab
  from (
    select nullif(btrim(x), '') as handle
    from unnest(coalesce(p_collaborators, '{}')) as x
  ) s
  where handle is not null;

  perform set_config('reel.transition', 'on', true);

  begin
    update public.projects
    set reel_prefix = v_prefix,
        data = jsonb_set(coalesce(data, '{}'::jsonb), '{reelPrefix}', to_jsonb(v_prefix), true)
    where id = p_project_id
      and (reel_prefix is null or reel_prefix = '');
  exception
    when unique_violation then
      null;
  end;

  insert into public.reel_sequences as seq (prefix, next_no)
  values (v_prefix, 1)
  on conflict (prefix) do update set next_no = seq.next_no + 1
  returning next_no into v_no;

  v_id := v_prefix || '-R' || lpad(v_no::text, 3, '0');

  insert into public.reels (
    id, project_id, project_name, client_name, title, brief, raw_footage_url,
    editor_id, editor_name, smm_id, smm_name, reviewer_id, reviewer_name,
    golive_at, t7, t5, t4, t3, rush, rush_reason, collaborators, platforms, status
  ) values (
    v_id,
    p_project_id,
    coalesce(v_project.data->>'name', v_project.data->>'projectName', ''),
    coalesce(v_project.data->>'clientName', ''),
    v_title,
    nullif(btrim(coalesce(p_brief, '')), ''),
    v_raw,
    p_editor_id,
    nullif(btrim(coalesce(p_editor_name, '')), ''),
    auth.uid()::text,
    nullif(btrim(coalesce(p_smm_name, '')), ''),
    nullif(btrim(coalesce(p_reviewer_id, '')), ''),
    nullif(btrim(coalesce(p_reviewer_name, '')), ''),
    p_golive,
    public.reel_deadline(p_golive, 7),
    public.reel_deadline(p_golive, 5),
    public.reel_deadline(p_golive, 4),
    public.reel_deadline(p_golive, 3),
    v_rush,
    case when v_rush then btrim(p_rush_reason) else null end,
    coalesce(v_collab, '{}'),
    v_platforms,
    'todo'
  );

  perform public.reel_log(v_id, 'planned', null, 'todo');

  if v_rush then
    foreach v_leader in array public.reel_leadership_ids() loop
      perform public.reel_notify(
        v_leader, v_id, 'rush_planned',
        'Rush reel ' || v_id,
        v_title || ' goes live in under 72 hours. ' || btrim(p_rush_reason),
        false, 'bell', 'Open task', false, null
      );
    end loop;
  end if;

  return v_id;
end;
$$;
