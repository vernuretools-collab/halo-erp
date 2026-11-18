-- Planning a reel no longer asks for a QC reviewer.

alter table public.reels
  alter column reviewer_id drop not null;

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
    if v_prefix !~ '^[A-Z0-9]{2,8}$' then
      raise exception 'Add a client code of 2 to 8 letters or numbers, such as HEKSH.';
    end if;
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

  update public.projects
  set reel_prefix = v_prefix,
      data = jsonb_set(coalesce(data, '{}'::jsonb), '{reelPrefix}', to_jsonb(v_prefix), true)
  where id = p_project_id
    and (reel_prefix is null or reel_prefix = '');

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

create or replace function public.reel_decide(p_reel_id text, p_decision text, p_feedback text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reels%rowtype;
  v public.reel_versions%rowtype;
  v_latest integer;
begin
  if p_decision not in ('changes', 'approved') then
    raise exception 'Decision must be changes or approved.';
  end if;
  select * into r from public.reels where id = p_reel_id for update;
  if not found then
    raise exception 'Reel not found.';
  end if;
  if r.status <> 'in_review' then
    raise exception 'This reel is not in review.';
  end if;
  if not (
    public.reel_is_leadership()
    or public.reel_same_person(r.reviewer_id)
    or (
      btrim(coalesce(r.reviewer_id, '')) = ''
      and public.reel_same_person(r.smm_id)
    )
  ) then
    raise exception 'Only the QC reviewer or leadership can decide this reel.';
  end if;

  select max(version_no) into v_latest from public.reel_versions where reel_id = p_reel_id;
  select * into v from public.reel_versions where reel_id = p_reel_id and version_no = v_latest;
  if not found then
    raise exception 'There is no version to decide.';
  end if;
  if v.decision <> 'pending' then
    raise exception 'Only the latest version can be decided, and it is already decided.';
  end if;

  if p_decision = 'changes' and btrim(coalesce(p_feedback, '')) = '' then
    raise exception 'Tell the editor what to change.';
  end if;

  update public.reel_versions
  set decision = p_decision,
      feedback = nullif(btrim(coalesce(p_feedback, '')), ''),
      decided_by = auth.uid()::text,
      decided_at = now()
  where id = v.id;

  if v.qc_item_id is not null then
    update public.qc_items
    set status = case when p_decision = 'approved' then 'approved' else 'changes_requested' end,
        reviewer_id = auth.uid()::text,
        updated_at = now()
    where id = v.qc_item_id;
  end if;

  perform set_config('reel.transition', 'on', true);
  if p_decision = 'changes' then
    update public.reels set status = 'changes_requested' where id = p_reel_id;
    perform public.reel_log(p_reel_id, 'changes_requested', 'in_review', 'changes_requested');
    perform public.reel_notify(
      r.editor_id, p_reel_id, 'changes_requested_v' || v.version_no::text,
      'Changes requested',
      r.id || ': ' || btrim(p_feedback),
      true, 'popup', 'Open task', false, null
    );
  else
    update public.reels
    set status = 'ready_to_schedule',
        full_quality_url = v.full_quality_url,
        last_reminder_at = now() - interval '30 minutes'
    where id = p_reel_id;
    perform public.reel_log(p_reel_id, 'approved', 'in_review', 'ready_to_schedule');
    perform public.reel_notify(
      r.smm_id, p_reel_id, 'qc_approved',
      'Ready to schedule',
      r.id || ' is approved. Schedule it.',
      true, 'popup', 'Schedule now', false, null
    );
  end if;
end;
$$;
