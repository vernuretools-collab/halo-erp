-- Progress alerts between SMM and editors.
-- Editors do not open Reels, so their copy is an inbox row that opens QC.
-- An editor upload on a reel still uses reel_notify, which the SMM already receives.

create or replace function public.qc_status_label(p_status text)
returns text
language sql
immutable
as $$
  select case p_status
    when 'todo' then 'To Do'
    when 'in_progress' then 'In Progress'
    when 'in_review' then 'In Review'
    when 'changes_requested' then 'Changes Requested'
    when 'approved' then 'Approved'
    when 'ready_to_schedule' then 'Ready to Schedule'
    when 'scheduled' then 'Scheduled'
    when 'published' then 'Published'
    else initcap(replace(coalesce(p_status, ''), '_', ' '))
  end;
$$;

create or replace function public.qc_actor_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select coalesce(
        nullif(btrim(e.data->>'name'), ''),
        nullif(btrim(e.data->>'displayName'), ''),
        nullif(btrim(e.data->>'fullName'), '')
      )
      from public.employees e
      where e.auth_id = auth.uid()
         or e.id = any (public.self_identity_ids())
         or coalesce(e.user_id, '') = any (public.self_identity_ids())
         or coalesce(e.data->>'uid', '') = any (public.self_identity_ids())
      limit 1
    ),
    'Someone'
  );
$$;

create or replace function public.qc_person_inbox_id(p_id text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select e.auth_id::text
      from public.employees e
      where e.auth_id is not null
        and (
          e.id = p_id
          or coalesce(e.user_id, '') = p_id
          or e.auth_id::text = p_id
          or coalesce(e.data->>'uid', '') = p_id
          or coalesce(e.data->>'employeeId', '') = p_id
        )
      limit 1
    ),
    nullif(p_id, '')
  );
$$;

create or replace function public.qc_notify_user(
  p_user_id text,
  p_title text,
  p_message text,
  p_tag text,
  p_reel_id text default null,
  p_item_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inbox text;
begin
  v_inbox := public.qc_person_inbox_id(p_user_id);
  if v_inbox is null or v_inbox = '' then
    return;
  end if;
  if v_inbox = any (public.self_identity_ids())
     or coalesce(p_user_id, '') = any (public.self_identity_ids()) then
    return;
  end if;
  perform public.insert_inbox_notification(v_inbox, jsonb_build_object(
    'title', p_title,
    'message', coalesce(p_message, ''),
    'type', 'qc',
    'isRead', false,
    'link', '/qc',
    'tag', coalesce(p_tag, 'qc-' || gen_random_uuid()::text),
    'createdAt', now()::text,
    'reelId', p_reel_id,
    'qcItemId', p_item_id
  ));
end;
$$;

create or replace function public.qc_notify_role(
  p_flag text,
  p_title text,
  p_message text,
  p_tag text,
  p_reel_id text default null,
  p_item_id text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  recip text;
begin
  for recip in
    select distinct public.qc_person_inbox_id(e.id)
    from public.employees e
    where (e.data -> p_flag) = 'true'::jsonb
       or e.data->>p_flag = 'true'
  loop
    perform public.qc_notify_user(
      recip,
      p_title,
      p_message,
      p_tag || '-' || recip,
      p_reel_id,
      p_item_id
    );
  end loop;
end;
$$;

create or replace function public.reel_move_stage(p_reel_id text, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reels%rowtype;
  allowed text[] := array['todo', 'in_progress', 'in_review', 'changes_requested'];
begin
  if auth.uid() is null then
    raise exception 'Sign in to move this reel.';
  end if;
  if not (coalesce(p_status, '') = any (allowed)) then
    raise exception 'Move a reel only between To Do, In Progress, In Review, and Changes Requested.';
  end if;

  select * into r from public.reels where id = p_reel_id for update;
  if not found then
    raise exception 'Reel not found.';
  end if;
  if not public.reel_can_read(r.smm_id, r.editor_id, r.reviewer_id) then
    raise exception 'You cannot move this reel.';
  end if;
  if not (r.status = any (allowed)) then
    raise exception 'This reel has left the editing stages.';
  end if;
  if r.status = p_status then
    return;
  end if;

  perform set_config('reel.transition', 'on', true);
  update public.reels
  set status = p_status,
      started_at = case
        when p_status = 'in_progress' and r.started_at is null then now()
        else r.started_at
      end
  where id = p_reel_id;
  perform public.reel_log(p_reel_id, 'stage', r.status, p_status);

  if not public.reel_same_person(r.editor_id) then
    perform public.qc_notify_user(
      r.editor_id,
      'Progress updated',
      format(
        '%s moved %s from %s to %s.',
        public.qc_actor_name(),
        r.id || ' (' || r.title || ')',
        public.qc_status_label(r.status),
        public.qc_status_label(p_status)
      ),
      'reel-stage-' || p_reel_id || '-' || substr(gen_random_uuid()::text, 1, 8),
      p_reel_id,
      null
    );
  end if;
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
    perform set_config('qc.skip_status_notify', 'on', true);
    update public.qc_items
    set status = case when p_decision = 'approved' then 'approved' else 'changes_requested' end,
        reviewer_id = auth.uid()::text,
        updated_at = now()
    where id = v.qc_item_id;
  end if;

  perform set_config('reel.transition', 'on', true);
  if p_decision = 'changes' then
    update public.reels set status = 'changes_requested', hide_video = false where id = p_reel_id;
    perform public.reel_log(p_reel_id, 'changes_requested', 'in_review', 'changes_requested');
    perform public.reel_notify(
      r.editor_id, p_reel_id, 'changes_requested_v' || v.version_no::text,
      'Changes requested',
      r.id || ': ' || btrim(p_feedback),
      true, 'popup', 'Open task', false, null
    );
    perform public.qc_notify_user(
      r.editor_id,
      'Changes requested',
      r.id || ' (' || r.title || '): ' || btrim(p_feedback),
      'qc-changes-' || p_reel_id || '-v' || v.version_no::text,
      p_reel_id,
      v.qc_item_id
    );
  else
    update public.reels
    set status = 'ready_to_schedule',
        hide_video = true,
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

create or replace function public.notify_qc_item_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_editor text;
  v_inbox text;
  v_title text;
  v_message text;
  v_tag text;
begin
  if current_setting('qc.skip_status_notify', true) = 'on' then
    return new;
  end if;
  if old.status is not distinct from new.status then
    return new;
  end if;
  if new.reel_id is not null then
    return new;
  end if;
  if new.status not in ('changes_requested', 'approved') then
    return new;
  end if;

  v_title := 'Progress updated';
  v_message := format(
    '%s moved "%s" from %s to %s.',
    coalesce(nullif(btrim(new.reviewer_name), ''), public.qc_actor_name()),
    new.title,
    public.qc_status_label(old.status),
    public.qc_status_label(new.status)
  );
  v_tag := 'qc-status-' || new.id || '-' || substr(gen_random_uuid()::text, 1, 8);

  select v.uploaded_by_id into v_editor
  from public.qc_versions v
  where v.item_id = new.id
  order by v.version_number desc
  limit 1;

  v_inbox := public.qc_person_inbox_id(v_editor);
  if v_inbox is not null
     and v_inbox <> ''
     and not (v_inbox = any (public.self_identity_ids()))
     and not (coalesce(v_editor, '') = any (public.self_identity_ids())) then
    perform public.qc_notify_user(v_editor, v_title, v_message, v_tag, null, new.id);
  else
    perform public.qc_notify_role('qcEditor', v_title, v_message, v_tag, null, new.id);
  end if;

  return new;
end;
$$;

create or replace function public.notify_qc_version_uploaded()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.qc_items%rowtype;
  v_inbox text;
  v_title text := 'New version uploaded';
  v_message text;
  v_tag text;
begin
  select * into item from public.qc_items where id = new.item_id;
  if not found or item.reel_id is not null then
    return new;
  end if;

  v_message := format(
    '%s uploaded v%s of "%s".',
    coalesce(nullif(btrim(new.uploaded_by_name), ''), 'An editor'),
    new.version_number,
    item.title
  );
  v_tag := 'qc-version-' || new.id;

  v_inbox := public.qc_person_inbox_id(item.reviewer_id);
  if v_inbox is not null
     and v_inbox <> ''
     and not (v_inbox = any (public.self_identity_ids()))
     and not (coalesce(item.reviewer_id, '') = any (public.self_identity_ids())) then
    perform public.qc_notify_user(item.reviewer_id, v_title, v_message, v_tag, null, item.id);
  else
    perform public.qc_notify_role('qcSmm', v_title, v_message, v_tag, null, item.id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_qc_item_status_notify on public.qc_items;
create trigger trg_qc_item_status_notify
  after update of status on public.qc_items
  for each row execute function public.notify_qc_item_status();

drop trigger if exists trg_qc_version_uploaded_notify on public.qc_versions;
create trigger trg_qc_version_uploaded_notify
  after insert on public.qc_versions
  for each row execute function public.notify_qc_version_uploaded();

revoke all on function public.qc_status_label(text) from public, anon;
revoke all on function public.qc_actor_name() from public, anon, authenticated;
revoke all on function public.qc_person_inbox_id(text) from public, anon, authenticated;
revoke all on function public.qc_notify_user(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.qc_notify_role(text, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.notify_qc_item_status() from public, anon, authenticated;
revoke all on function public.notify_qc_version_uploaded() from public, anon, authenticated;

grant execute on function public.qc_status_label(text) to authenticated;
