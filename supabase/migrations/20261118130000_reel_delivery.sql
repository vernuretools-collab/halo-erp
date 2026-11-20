-- Reel delivery: planning, QC-driven statuses, reminders, and risk.
-- Status, go-live, and deadlines change only inside these functions.

alter table public.projects
  add column if not exists reel_prefix text;

create unique index if not exists projects_reel_prefix_uidx
  on public.projects (reel_prefix)
  where reel_prefix is not null and reel_prefix <> '';

alter table public.qc_items
  add column if not exists reel_id text;

create table if not exists public.reel_sequences (
  prefix text primary key,
  next_no integer not null default 0 check (next_no >= 0)
);

create table if not exists public.reels (
  id text primary key,
  project_id text not null,
  project_name text,
  client_name text,
  title text not null,
  brief text,
  raw_footage_url text not null,
  editor_id text not null,
  editor_name text,
  smm_id text not null,
  smm_name text,
  reviewer_id text not null,
  reviewer_name text,
  golive_at timestamptz not null,
  t7 timestamptz not null,
  t5 timestamptz not null,
  t4 timestamptz not null,
  t3 timestamptz not null,
  rush boolean not null default false,
  rush_reason text,
  collaborators text[] not null default '{}',
  platforms text[] not null default '{instagram}',
  status text not null default 'todo'
    check (status in (
      'todo', 'in_progress', 'in_review', 'changes_requested',
      'ready_to_schedule', 'scheduled', 'published'
    )),
  full_quality_url text,
  caption text,
  cover_set boolean not null default false,
  collab_sent boolean not null default false,
  confirmed_time timestamptz,
  scheduled_at timestamptz,
  published_at timestamptz,
  post_url text,
  last_reminder_at timestamptz,
  golive_check_sent_at timestamptz,
  last_alarm_at timestamptz,
  started_at timestamptz,
  risk_status text not null default 'on_track',
  hide_video boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reel_versions (
  id text primary key,
  reel_id text not null references public.reels (id) on delete cascade,
  version_no integer not null check (version_no > 0),
  review_file_url text not null,
  review_size_mb numeric,
  byte_size bigint,
  file_name text,
  content_type text,
  full_quality_url text not null,
  uploaded_by text,
  uploaded_at timestamptz not null default now(),
  decision text not null default 'pending'
    check (decision in ('pending', 'changes', 'approved')),
  feedback text,
  decided_by text,
  decided_at timestamptz,
  qc_item_id text,
  qc_version_id text,
  unique (reel_id, version_no)
);

create table if not exists public.reel_notifications (
  id text primary key,
  user_id text not null,
  reel_id text,
  key text not null,
  title text not null,
  body text,
  needs_answer boolean not null default false,
  presentation text not null default 'bell'
    check (presentation in ('popup', 'bell', 'desktop_bell')),
  sound boolean not null default false,
  buttons text,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  answer text check (answer in ('yes', 'no') or answer is null),
  answered_at timestamptz,
  reminder_log_id text
);

create unique index if not exists reel_notifications_once
  on public.reel_notifications (coalesce(reel_id, ''), key, user_id)
  where key not in ('schedule_reminder', 'golive_check');

create table if not exists public.reel_reminder_log (
  id text primary key,
  reel_id text not null references public.reels (id) on delete cascade,
  kind text not null check (kind in ('schedule', 'golive')),
  sent_at timestamptz not null default now(),
  answer text check (answer in ('yes', 'no') or answer is null),
  answered_at timestamptz,
  user_id text
);

create table if not exists public.client_quota (
  project_id text not null,
  month text not null check (month ~ '^[0-9]{4}-[0-9]{2}$'),
  reels_contracted integer not null check (reels_contracted > 0),
  primary key (project_id, month)
);

create table if not exists public.reel_activity (
  id text primary key,
  reel_id text not null references public.reels (id) on delete cascade,
  actor_id text,
  action text not null,
  from_status text,
  to_status text,
  created_at timestamptz not null default now()
);

create table if not exists public.reel_digest_sends (
  user_id text not null,
  sent_on date not null,
  primary key (user_id, sent_on)
);

create table if not exists public.reel_quota_alerts (
  project_id text not null,
  month text not null,
  primary key (project_id, month)
);

create index if not exists reels_status_idx on public.reels (status);
create index if not exists reels_project_idx on public.reels (project_id);
create index if not exists reels_golive_idx on public.reels (golive_at);
create index if not exists reels_editor_idx on public.reels (editor_id);
create index if not exists reel_notifications_user_idx on public.reel_notifications (user_id, created_at desc);
create index if not exists reel_activity_reel_idx on public.reel_activity (reel_id, created_at desc);
create index if not exists qc_items_reel_id_idx on public.qc_items (reel_id);

alter table public.reels replica identity full;
alter table public.reel_notifications replica identity full;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.reel_deadline(p_golive timestamptz, p_days integer)
returns timestamptz
language plpgsql
stable
set search_path = public
as $$
declare
  d date;
begin
  d := ((p_golive at time zone 'Asia/Kolkata')::date - p_days);
  if extract(dow from d) = 0 then
    d := d - 1;
  end if;
  return (d + time '20:00') at time zone 'Asia/Kolkata';
end;
$$;

create or replace function public.reel_same_person(p_id text)
returns boolean
language sql
stable
set search_path = public
as $$
  select p_id is not null and p_id <> '' and p_id = any (public.self_identity_ids());
$$;

create or replace function public.reel_is_leadership()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.self_is_admin()
    or exists (
      select 1
      from public.employees e
      where (
        e.auth_id = auth.uid()
        or e.id = any (public.self_identity_ids())
        or e.user_id = any (public.self_identity_ids())
        or coalesce(e.data->>'uid', '') = any (public.self_identity_ids())
      )
      and lower(coalesce(
        e.data->>'name',
        e.data->>'displayName',
        e.data->>'fullName',
        ''
      )) ~ '(vivek|swathish|vedhika)'
    );
$$;

create or replace function public.reel_leadership_ids()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct uid), '{}'::text[])
  from (
    select coalesce(nullif(e.data->>'uid', ''), nullif(e.user_id, ''), e.id) as uid
    from public.employees e
    where lower(coalesce(e.data->>'name', e.data->>'displayName', e.data->>'fullName', ''))
      ~ '(vivek|swathish|vedhika)'
      and coalesce(e.data->>'status', 'active') not in ('relieved', 'archived')
  ) s
  where uid is not null and uid <> '';
$$;

create or replace function public.reel_can_plan()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  title text;
begin
  if auth.uid() is null or not public.is_qc_staff() then
    return false;
  end if;
  if public.reel_is_leadership() then
    return true;
  end if;
  select lower(coalesce(
    e.data->>'designation',
    e.data->>'roleName',
    e.data->>'jobTitle',
    e.data->>'title',
    ''
  ))
  into title
  from public.employees e
  where e.auth_id = auth.uid()
     or e.id = any (public.self_identity_ids())
     or coalesce(e.data->>'uid', '') = any (public.self_identity_ids())
  limit 1;
  if title is null or title = '' then
    return true;
  end if;
  if title ~ '(editor|qc|quality)' and title !~ '(social|smm|content|marketing)' then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.reel_can_read(p_smm text, p_editor text, p_reviewer text)
returns boolean
language sql
stable
set search_path = public
as $$
  select
    public.is_qc_staff()
    and (
      public.reel_is_leadership()
      or public.reel_same_person(p_smm)
      or public.reel_same_person(p_editor)
      or public.reel_same_person(p_reviewer)
    );
$$;

create or replace function public.reel_compute_risk(p_status text, p_golive timestamptz, p_t7 timestamptz, p_t5 timestamptz, p_t4 timestamptz, p_t3 timestamptz, p_now timestamptz)
returns text
language plpgsql
stable
set search_path = public
as $$
begin
  if p_status = 'published' then return 'published'; end if;
  if p_now > p_golive + interval '60 minutes' then return 'missed'; end if;
  if p_status <> 'scheduled' and p_now > p_t3 then return 'late'; end if;
  if p_status = 'todo' and p_now > p_t7 then return 'at_risk'; end if;
  if p_status in ('todo', 'in_progress') and p_now > p_t5 then return 'at_risk'; end if;
  if p_status in ('todo', 'in_progress', 'in_review', 'changes_requested') and p_now > p_t4 then return 'at_risk'; end if;
  return 'on_track';
end;
$$;

create or replace function public.reel_require_url(p_url text, p_message text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  trimmed text := btrim(coalesce(p_url, ''));
begin
  if trimmed !~* '^https?://[^[:space:]]+$' then
    raise exception '%', p_message;
  end if;
  return trimmed;
end;
$$;

create or replace function public.reel_touch()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reels_touch on public.reels;
create trigger reels_touch
  before update on public.reels
  for each row execute function public.reel_touch();

create or replace function public.reel_guard_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(current_setting('reel.transition', true), '') = 'on' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    raise exception 'Create reels with the plan action.';
  end if;
  if new.status is distinct from old.status
     or new.golive_at is distinct from old.golive_at
     or new.t7 is distinct from old.t7
     or new.t5 is distinct from old.t5
     or new.t4 is distinct from old.t4
     or new.t3 is distinct from old.t3
  then
    raise exception 'Reel status, go-live, and deadlines change only through delivery actions.';
  end if;
  return new;
end;
$$;

drop trigger if exists reels_guard_transition on public.reels;
create trigger reels_guard_transition
  before insert or update on public.reels
  for each row execute function public.reel_guard_transition();

create or replace function public.reel_log(p_reel_id text, p_action text, p_from text, p_to text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.reel_activity (id, reel_id, actor_id, action, from_status, to_status)
  values (gen_random_uuid()::text, p_reel_id, auth.uid()::text, p_action, p_from, p_to);
end;
$$;

create or replace function public.reel_notify(
  p_user_id text,
  p_reel_id text,
  p_key text,
  p_title text,
  p_body text,
  p_needs_answer boolean,
  p_presentation text,
  p_buttons text,
  p_sound boolean,
  p_log_kind text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id text := gen_random_uuid()::text;
  v_log text;
  v_link text;
begin
  if p_user_id is null or p_user_id = '' then
    return;
  end if;
  if p_key in ('schedule_reminder', 'golive_check') then
    update public.reel_notifications
    set needs_answer = false,
        read_at = coalesce(read_at, now())
    where reel_id = p_reel_id
      and key = p_key
      and user_id = p_user_id
      and needs_answer = true
      and answer is null;
  end if;
  if p_key not in ('schedule_reminder', 'golive_check') and exists (
    select 1 from public.reel_notifications n
    where coalesce(n.reel_id, '') = coalesce(p_reel_id, '')
      and n.key = p_key
      and n.user_id = p_user_id
  ) then
    return;
  end if;

  if p_log_kind is not null and p_reel_id is not null then
    v_log := gen_random_uuid()::text;
    insert into public.reel_reminder_log (id, reel_id, kind, sent_at, user_id)
    values (v_log, p_reel_id, p_log_kind, now(), p_user_id);
  end if;

  insert into public.reel_notifications (
    id, user_id, reel_id, key, title, body, needs_answer, presentation, sound, buttons, reminder_log_id
  ) values (
    v_id, p_user_id, p_reel_id, p_key, p_title, p_body,
    coalesce(p_needs_answer, false),
    coalesce(p_presentation, 'bell'),
    coalesce(p_sound, false),
    p_buttons,
    v_log
  );

  v_link := case when p_reel_id is null then '/reels' else '/reels/' || p_reel_id end;
  perform public.insert_inbox_notification(p_user_id, jsonb_build_object(
    'title', p_title,
    'message', coalesce(p_body, ''),
    'type', 'reel',
    'isRead', false,
    'link', v_link,
    'tag', concat('reel-', coalesce(p_reel_id, 'none'), '-', p_key, '-', v_id),
    'createdAt', now()::text,
    'reelId', p_reel_id,
    'reelKey', p_key
  ));
end;
$$;

create or replace function public.reel_close_prompts(p_reel_id text, p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.reel_notifications
  set needs_answer = false,
      read_at = coalesce(read_at, now())
  where reel_id = p_reel_id
    and key = p_key
    and needs_answer = true;
end;
$$;

create or replace function public.reel_next_unmet(
  p_reel_id text,
  p_status text,
  p_t5 timestamptz,
  p_t4 timestamptz,
  p_t3 timestamptz
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_status in ('scheduled', 'published') then
    return null;
  end if;
  if not exists (select 1 from public.reel_versions v where v.reel_id = p_reel_id) then
    return p_t5;
  end if;
  if p_status in ('todo', 'in_progress', 'in_review', 'changes_requested') then
    return p_t4;
  end if;
  return p_t3;
end;
$$;

-- ---------------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------------

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
begin
  if auth.uid() is null or not public.is_qc_staff() then
    raise exception 'You cannot plan reels.';
  end if;
  select nullif(reel_prefix, '') into v_prefix from public.projects where id = p_project_id;
  if v_prefix is null then
    v_prefix := upper(btrim(coalesce(p_prefix, '')));
  end if;
  if v_prefix !~ '^[A-Z0-9]{2,8}$' then
    return '';
  end if;
  select next_no into v_no from public.reel_sequences where prefix = v_prefix;
  return v_prefix || '-R' || lpad((coalesce(v_no, 0) + 1)::text, 3, '0');
end;
$$;

create or replace function public.reel_editor_workload(p_golive timestamptz)
returns table (editor_id text, due_on date, cut_count integer)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_due date;
begin
  if auth.uid() is null or not public.is_qc_staff() then
    raise exception 'You cannot plan reels.';
  end if;
  v_due := (public.reel_deadline(p_golive, 5) at time zone 'Asia/Kolkata')::date;
  return query
  select r.editor_id, v_due, count(*)::integer
  from public.reels r
  where (r.t5 at time zone 'Asia/Kolkata')::date = v_due
  group by r.editor_id;
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
  if btrim(coalesce(p_reviewer_id, '')) = '' then
    raise exception 'Choose a QC reviewer.';
  end if;
  if p_editor_id = p_reviewer_id then
    raise exception 'The editor and the QC reviewer have to be different people.';
  end if;
  v_raw := public.reel_require_url(p_raw_footage_url, 'Add the raw footage link.');

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
    p_reviewer_id,
    nullif(btrim(coalesce(p_reviewer_name, '')), ''),
    p_golive,
    public.reel_deadline(p_golive, 7),
    public.reel_deadline(p_golive, 5),
    public.reel_deadline(p_golive, 4),
    public.reel_deadline(p_golive, 3),
    v_rush,
    case when v_rush then btrim(p_rush_reason) else null end,
    coalesce(v_collab, '{}'),
    coalesce(p_platforms, '{instagram}'),
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

create or replace function public.reel_start(p_reel_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reels%rowtype;
begin
  select * into r from public.reels where id = p_reel_id for update;
  if not found then
    raise exception 'Reel not found.';
  end if;
  if not public.reel_same_person(r.editor_id) then
    raise exception 'Only the assigned editor can start this reel.';
  end if;
  if r.status <> 'todo' then
    raise exception 'This reel is already started.';
  end if;
  perform set_config('reel.transition', 'on', true);
  update public.reels
  set status = 'in_progress', started_at = now()
  where id = p_reel_id;
  perform public.reel_log(p_reel_id, 'started', 'todo', 'in_progress');
end;
$$;

create or replace function public.reel_add_version(
  p_reel_id text,
  p_storage_path text,
  p_file_name text,
  p_content_type text,
  p_byte_size bigint,
  p_full_quality_url text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reels%rowtype;
  v_no integer;
  v_version_id text := gen_random_uuid()::text;
  v_qc_item text;
  v_qc_version text := gen_random_uuid()::text;
  v_url text;
  v_actor text := auth.uid()::text;
begin
  select * into r from public.reels where id = p_reel_id for update;
  if not found then
    raise exception 'Reel not found.';
  end if;
  if not public.reel_same_person(r.editor_id) then
    raise exception 'Only the assigned editor can upload a version.';
  end if;
  if r.status not in ('in_progress', 'changes_requested') then
    raise exception 'Upload a version only while the reel is in progress or changes were requested.';
  end if;
  if p_byte_size is null or p_byte_size <= 0 then
    raise exception 'Choose an MP4 or WebM review file.';
  end if;
  if p_byte_size > 52428800 then
    raise exception 'This review file is over 50 MB. Upload an MP4 or WebM that is 50 MB or less.';
  end if;
  if lower(coalesce(p_file_name, '')) !~ '\.(mp4|webm)$'
     and lower(coalesce(p_content_type, '')) not in ('video/mp4', 'video/webm') then
    raise exception 'Review files must be MP4 or WebM.';
  end if;
  if coalesce(p_storage_path, '') !~ ('^' || p_reel_id || '/v[0-9]+-') then
    raise exception 'The review file path does not match this reel.';
  end if;
  v_url := public.reel_require_url(p_full_quality_url, 'Add the full-quality link. That link is required.');

  select coalesce(max(version_no), 0) + 1 into v_no from public.reel_versions where reel_id = p_reel_id;

  select id into v_qc_item from public.qc_items where reel_id = p_reel_id limit 1;
  if v_qc_item is null then
    v_qc_item := gen_random_uuid()::text;
    insert into public.qc_items (id, project_id, title, status, uploader_id, uploader_name, reel_id)
    values (v_qc_item, r.project_id, r.title, 'in_review', v_actor, r.editor_name, p_reel_id);
  else
    update public.qc_items
    set status = 'in_review', updated_at = now()
    where id = v_qc_item;
  end if;

  insert into public.qc_versions (
    id, item_id, version_number, storage_path, file_name, content_type, byte_size, uploaded_by_id, uploaded_by_name
  ) values (
    v_qc_version, v_qc_item, v_no, p_storage_path, coalesce(p_file_name, 'cut.mp4'),
    p_content_type, p_byte_size, r.editor_id, r.editor_name
  );

  insert into public.reel_versions (
    id, reel_id, version_no, review_file_url, review_size_mb, byte_size, file_name, content_type,
    full_quality_url, uploaded_by, qc_item_id, qc_version_id
  ) values (
    v_version_id, p_reel_id, v_no, p_storage_path,
    round((p_byte_size / 1048576.0)::numeric, 2),
    p_byte_size, p_file_name, p_content_type, v_url, v_actor, v_qc_item, v_qc_version
  );

  perform set_config('reel.transition', 'on', true);
  update public.reels set status = 'in_review' where id = p_reel_id;
  perform public.reel_log(p_reel_id, 'version_' || v_no::text, r.status, 'in_review');

  perform public.reel_notify(
    r.reviewer_id, p_reel_id, 'cut_uploaded_v' || v_no::text,
    'Cut ready for review',
    r.id || ' v' || v_no::text || ' is ready to review.',
    true, 'popup', 'Open review', false, null
  );
  if r.smm_id is distinct from r.reviewer_id then
    perform public.reel_notify(
      r.smm_id, p_reel_id, 'cut_uploaded_v' || v_no::text,
      'Cut ready for review',
      r.id || ' v' || v_no::text || ' is ready to review.',
      true, 'popup', 'Open review', false, null
    );
  end if;

  return v_version_id;
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

create or replace function public.reel_schedule(
  p_reel_id text,
  p_caption text,
  p_cover_set boolean,
  p_collab_sent boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reels%rowtype;
begin
  select * into r from public.reels where id = p_reel_id for update;
  if not found then
    raise exception 'Reel not found.';
  end if;
  if not (public.reel_is_leadership() or public.reel_same_person(r.smm_id)) then
    raise exception 'Only the SMM or leadership can schedule this reel.';
  end if;
  if r.status <> 'ready_to_schedule' then
    raise exception 'Schedule a reel only after QC has approved it.';
  end if;
  if btrim(coalesce(p_caption, '')) = '' then
    raise exception 'Add the caption.';
  end if;
  if coalesce(p_cover_set, false) is not true then
    raise exception 'Confirm the cover is set.';
  end if;
  if coalesce(array_length(r.collaborators, 1), 0) > 0 and coalesce(p_collab_sent, false) is not true then
    raise exception 'Confirm the collab invite was sent.';
  end if;

  perform set_config('reel.transition', 'on', true);
  update public.reels
  set status = 'scheduled',
      caption = btrim(p_caption),
      cover_set = true,
      collab_sent = coalesce(p_collab_sent, false) or coalesce(array_length(r.collaborators, 1), 0) = 0,
      confirmed_time = r.golive_at,
      scheduled_at = now()
  where id = p_reel_id;
  perform public.reel_close_prompts(p_reel_id, 'schedule_reminder');
  perform public.reel_log(p_reel_id, 'scheduled', 'ready_to_schedule', 'scheduled');
end;
$$;

create or replace function public.reel_publish(p_reel_id text, p_post_url text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reels%rowtype;
  v_url text;
begin
  select * into r from public.reels where id = p_reel_id for update;
  if not found then
    raise exception 'Reel not found.';
  end if;
  if not (public.reel_is_leadership() or public.reel_same_person(r.smm_id)) then
    raise exception 'Only the SMM or leadership can publish this reel.';
  end if;
  if r.status <> 'scheduled' then
    raise exception 'Add the post link only after the reel is scheduled.';
  end if;
  v_url := public.reel_require_url(p_post_url, 'Add a valid post link.');

  perform set_config('reel.transition', 'on', true);
  update public.reels
  set status = 'published',
      post_url = v_url,
      published_at = now(),
      risk_status = 'published'
  where id = p_reel_id;
  perform public.reel_close_prompts(p_reel_id, 'golive_check');
  perform public.reel_log(p_reel_id, 'published', 'scheduled', 'published');
end;
$$;

create or replace function public.reel_set_golive(p_reel_id text, p_golive timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reels%rowtype;
  v_old timestamptz;
  v_t7 timestamptz;
  v_t5 timestamptz;
  v_t4 timestamptz;
  v_t3 timestamptz;
  v_new timestamptz;
begin
  if p_golive is null then
    raise exception 'A reel cannot be left without a go-live date.';
  end if;
  select * into r from public.reels where id = p_reel_id for update;
  if not found then
    raise exception 'Reel not found.';
  end if;
  if not (public.reel_is_leadership() or public.reel_same_person(r.smm_id)) then
    raise exception 'Only the SMM or leadership can change the go-live date.';
  end if;
  if r.status = 'published' then
    raise exception 'This reel is already published.';
  end if;

  v_old := public.reel_next_unmet(r.id, r.status, r.t5, r.t4, r.t3);
  v_t7 := public.reel_deadline(p_golive, 7);
  v_t5 := public.reel_deadline(p_golive, 5);
  v_t4 := public.reel_deadline(p_golive, 4);
  v_t3 := public.reel_deadline(p_golive, 3);
  v_new := public.reel_next_unmet(r.id, r.status, v_t5, v_t4, v_t3);

  perform set_config('reel.transition', 'on', true);
  update public.reels
  set golive_at = p_golive,
      t7 = v_t7,
      t5 = v_t5,
      t4 = v_t4,
      t3 = v_t3,
      confirmed_time = case when status = 'scheduled' then p_golive else confirmed_time end
  where id = p_reel_id;
  perform public.reel_log(p_reel_id, 'golive_changed', r.status, r.status);

  if v_old is not null and v_new is not null and v_new < v_old then
    perform public.reel_notify(
      r.editor_id, p_reel_id, 'deadline_moved_' || to_char(now() at time zone 'Asia/Kolkata', 'YYYYMMDDHH24MISS'),
      'Deadline moved earlier',
      r.id || ' now needs the next cut sooner.',
      false, 'bell', 'Open task', false, null
    );
  end if;
end;
$$;

create or replace function public.reel_set_quota(p_project_id text, p_month text, p_count integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.reel_can_plan() then
    raise exception 'Only an SMM or leadership can set the monthly quota.';
  end if;
  if p_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'Month must look like 2026-11.';
  end if;
  if p_count is null or p_count < 1 then
    raise exception 'Enter how many reels were contracted.';
  end if;
  insert into public.client_quota (project_id, month, reels_contracted)
  values (p_project_id, p_month, p_count)
  on conflict (project_id, month) do update set reels_contracted = excluded.reels_contracted;
end;
$$;

create or replace function public.reel_answer(p_notification_id text, p_answer text)
returns table (reel_id text, key text, open_path text)
language plpgsql
security definer
set search_path = public
as $$
declare
  n public.reel_notifications%rowtype;
begin
  if p_answer not in ('yes', 'no') then
    raise exception 'Answer yes or no.';
  end if;
  select * into n from public.reel_notifications where id = p_notification_id for update;
  if not found then
    raise exception 'That reminder is gone.';
  end if;
  if not public.reel_same_person(n.user_id) and not public.reel_is_leadership() then
    raise exception 'This reminder is for someone else.';
  end if;

  update public.reel_notifications
  set answer = p_answer,
      answered_at = now(),
      needs_answer = false,
      read_at = coalesce(read_at, now())
  where id = n.id;

  if n.reminder_log_id is not null then
    update public.reel_reminder_log
    set answer = p_answer, answered_at = now(), user_id = auth.uid()::text
    where id = n.reminder_log_id;
  end if;

  reel_id := n.reel_id;
  key := n.key;
  open_path := case
    when p_answer = 'no' and n.key in ('schedule_reminder', 'golive_check') then '/reels/' || n.reel_id
    when p_answer = 'yes' and n.key in ('qc_approved', 'schedule_reminder') then '/reels/' || n.reel_id || '?checklist=1'
    when p_answer = 'yes' and n.key = 'golive_check' then '/reels/' || n.reel_id || '?publish=1'
    when p_answer = 'yes' and n.key like 'cut_uploaded%' then '/qc'
    when p_answer = 'yes' and n.key like 'changes_requested%' then '/reels/' || n.reel_id
    else null
  end;
  return next;
end;
$$;

create or replace function public.reel_on_time_scores(p_month text)
returns table (
  scope text,
  scope_id text,
  scheduled_on_time integer,
  scheduled_due integer,
  live_on_time integer,
  live_due integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_month !~ '^[0-9]{4}-[0-9]{2}$' then
    raise exception 'Month must look like 2026-11.';
  end if;
  return query
  with visible as (
    select *
    from public.reels r
    where public.reel_is_leadership()
       or public.reel_same_person(r.smm_id)
  ),
  scoped as (
    select 'client'::text as scope, v.project_id as scope_id, v.*
    from visible v
    union all
    select 'smm'::text, v.smm_id, v.*
    from visible v
  )
  select
    s.scope,
    s.scope_id,
    count(*) filter (
      where to_char(s.t3 at time zone 'Asia/Kolkata', 'YYYY-MM') = p_month
        and s.t3 <= now()
        and s.scheduled_at is not null
        and s.scheduled_at <= s.t3
    )::integer,
    count(*) filter (
      where to_char(s.t3 at time zone 'Asia/Kolkata', 'YYYY-MM') = p_month
        and s.t3 <= now()
    )::integer,
    count(*) filter (
      where to_char(s.golive_at at time zone 'Asia/Kolkata', 'YYYY-MM') = p_month
        and s.golive_at <= now()
        and s.published_at is not null
        and s.published_at <= s.golive_at + interval '60 minutes'
    )::integer,
    count(*) filter (
      where to_char(s.golive_at at time zone 'Asia/Kolkata', 'YYYY-MM') = p_month
        and s.golive_at <= now()
    )::integer
  from scoped s
  group by s.scope, s.scope_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scheduler
-- ---------------------------------------------------------------------------

create or replace function public.reel_scheduler_tick()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.reels%rowtype;
  v_local timestamp;
  v_mins integer;
  v_dow integer;
  v_in_window boolean;
  v_workday boolean;
  v_risk text;
  v_leader text;
  v_smm text;
  v_ready integer;
  v_risk_count integer;
  v_today integer;
  v_next_month text;
  v_planned integer;
  q record;
begin
  perform set_config('reel.transition', 'on', true);
  v_local := now() at time zone 'Asia/Kolkata';
  v_mins := extract(hour from v_local)::integer * 60 + extract(minute from v_local)::integer;
  v_dow := extract(dow from v_local)::integer;
  v_in_window := v_dow between 1 and 6 and v_mins >= (9 * 60 + 30) and v_mins <= (20 * 60);
  v_workday := v_dow between 1 and 6;

  for r in select * from public.reels where status = 'ready_to_schedule' loop
    if v_in_window and (r.last_reminder_at is null or now() - r.last_reminder_at >= interval '30 minutes') then
      perform public.reel_notify(
        r.smm_id, r.id, 'schedule_reminder',
        'Schedule ' || r.id,
        'Have you scheduled ' || r.title || '?',
        true, 'popup', 'Yes', false, 'schedule'
      );
      update public.reels set last_reminder_at = now() where id = r.id;
    end if;
  end loop;

  for r in select * from public.reels where status = 'scheduled' and now() >= golive_at loop
    if r.golive_check_sent_at is null or r.last_alarm_at is null or now() - r.last_alarm_at >= interval '10 minutes' then
      perform public.reel_notify(
        r.smm_id, r.id, 'golive_check',
        r.id || ' should be live',
        'Is ' || r.title || ' live?',
        true, 'popup', 'Yes, it''s live', true, 'golive'
      );
      update public.reels
      set last_alarm_at = now(),
          golive_check_sent_at = coalesce(golive_check_sent_at, now())
      where id = r.id;
    end if;
  end loop;

  for r in select * from public.reels where status <> 'published' loop
    v_risk := public.reel_compute_risk(r.status, r.golive_at, r.t7, r.t5, r.t4, r.t3, now());
    if v_risk is distinct from r.risk_status then
      update public.reels set risk_status = v_risk where id = r.id;
    end if;

    if r.status = 'todo' and now() > r.t7 then
      perform public.reel_notify(r.smm_id, r.id, 'at_risk_t7', 'T-7 missed', r.id || ' missed the brief deadline.', false, 'bell', 'Open task', false, null);
      perform public.reel_notify(r.editor_id, r.id, 'at_risk_t7', 'T-7 missed', r.id || ' missed the brief deadline.', false, 'bell', 'Open task', false, null);
    end if;
    if r.status in ('todo', 'in_progress') and now() > r.t5 then
      perform public.reel_notify(r.smm_id, r.id, 'at_risk_t5', 'T-5 missed', r.id || ' missed the first-cut deadline.', false, 'bell', 'Open task', false, null);
      perform public.reel_notify(r.editor_id, r.id, 'at_risk_t5', 'T-5 missed', r.id || ' missed the first-cut deadline.', false, 'bell', 'Open task', false, null);
    end if;
    if r.status in ('todo', 'in_progress', 'in_review', 'changes_requested') and now() > r.t4 then
      perform public.reel_notify(r.smm_id, r.id, 'at_risk_t4', 'T-4 missed', r.id || ' missed QC approval.', false, 'bell', 'Open task', false, null);
      perform public.reel_notify(r.editor_id, r.id, 'at_risk_t4', 'T-4 missed', r.id || ' missed QC approval.', false, 'bell', 'Open task', false, null);
    end if;
    if r.status <> 'scheduled' and now() > r.t3 then
      foreach v_leader in array public.reel_leadership_ids() loop
        perform public.reel_notify(
          v_leader, r.id, 'esc_late',
          'Late: ' || r.id,
          r.id || ' was not scheduled by T-3.',
          false, 'desktop_bell', 'Open task', false, null
        );
      end loop;
    end if;
    if now() > r.golive_at + interval '60 minutes' then
      foreach v_leader in array public.reel_leadership_ids() loop
        perform public.reel_notify(
          v_leader, r.id, 'esc_missed',
          'Missed go-live: ' || r.id,
          r.id || ' is still not published.',
          false, 'desktop_bell', 'Open task', false, null
        );
      end loop;
      perform public.reel_notify(
        r.smm_id, r.id, 'esc_missed',
        'Missed go-live: ' || r.id,
        r.id || ' is still not published.',
        false, 'desktop_bell', 'Open task', false, null
      );
    end if;
  end loop;

  if v_workday and v_mins >= (9 * 60 + 30) and v_mins < (9 * 60 + 40) then
    for v_smm in select distinct smm_id from public.reels where status <> 'published' loop
      insert into public.reel_digest_sends (user_id, sent_on)
      values (v_smm, v_local::date)
      on conflict do nothing;
      if found then
        select
          count(*) filter (where status = 'ready_to_schedule'),
          count(*) filter (where public.reel_compute_risk(status, golive_at, t7, t5, t4, t3, now()) = 'at_risk'),
          count(*) filter (where (golive_at at time zone 'Asia/Kolkata')::date = v_local::date)
        into v_ready, v_risk_count, v_today
        from public.reels
        where smm_id = v_smm and status <> 'published';
        perform public.reel_notify(
          v_smm, null, 'daily_digest_' || to_char(v_local::date, 'YYYY-MM-DD'),
          'Reel digest',
          v_ready::text || ' ready to schedule, ' || v_risk_count::text || ' at risk, ' || v_today::text || ' going live today.',
          false, 'bell', null, false, null
        );
      end if;
    end loop;
  end if;

  if extract(day from v_local)::integer = 25 then
    v_next_month := to_char((v_local::date + interval '1 month'), 'YYYY-MM');
    for q in select * from public.client_quota where month = v_next_month loop
      select count(*) into v_planned
      from public.reels
      where project_id = q.project_id
        and to_char(golive_at at time zone 'Asia/Kolkata', 'YYYY-MM') = v_next_month;
      if v_planned < q.reels_contracted then
        insert into public.reel_quota_alerts (project_id, month)
        values (q.project_id, v_next_month)
        on conflict do nothing;
        if found then
          foreach v_leader in array public.reel_leadership_ids() loop
            perform public.reel_notify(
              v_leader, null, 'quota_gap_' || q.project_id || '_' || v_next_month,
              'Next month is not fully planned',
              'Planned ' || v_planned::text || ' of ' || q.reels_contracted::text || ' reels.',
              false, 'bell', null, false, null
            );
          end loop;
          for v_smm in
            select distinct smm_id from public.reels where project_id = q.project_id
          loop
            perform public.reel_notify(
              v_smm, null, 'quota_gap_' || q.project_id || '_' || v_next_month,
              'Next month is not fully planned',
              'Planned ' || v_planned::text || ' of ' || q.reels_contracted::text || ' reels.',
              false, 'bell', null, false, null
            );
          end loop;
        end if;
      end if;
    end loop;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Access
-- ---------------------------------------------------------------------------

alter table public.reels enable row level security;
alter table public.reel_versions enable row level security;
alter table public.reel_notifications enable row level security;
alter table public.reel_reminder_log enable row level security;
alter table public.client_quota enable row level security;
alter table public.reel_activity enable row level security;
alter table public.reel_sequences enable row level security;
alter table public.reel_digest_sends enable row level security;
alter table public.reel_quota_alerts enable row level security;

drop policy if exists reels_select on public.reels;
create policy reels_select on public.reels
  for select to authenticated
  using (public.reel_can_read(smm_id, editor_id, reviewer_id));

drop policy if exists reel_versions_select on public.reel_versions;
create policy reel_versions_select on public.reel_versions
  for select to authenticated
  using (
    exists (
      select 1 from public.reels r
      where r.id = reel_versions.reel_id
        and public.reel_can_read(r.smm_id, r.editor_id, r.reviewer_id)
    )
  );

drop policy if exists reel_notifications_select on public.reel_notifications;
create policy reel_notifications_select on public.reel_notifications
  for select to authenticated
  using (public.reel_same_person(user_id) or public.reel_is_leadership());

drop policy if exists reel_reminder_log_select on public.reel_reminder_log;
create policy reel_reminder_log_select on public.reel_reminder_log
  for select to authenticated
  using (
    public.reel_is_leadership()
    or exists (
      select 1 from public.reels r
      where r.id = reel_reminder_log.reel_id
        and public.reel_same_person(r.smm_id)
    )
  );

drop policy if exists client_quota_select on public.client_quota;
create policy client_quota_select on public.client_quota
  for select to authenticated
  using (public.is_qc_staff());

drop policy if exists reel_activity_select on public.reel_activity;
create policy reel_activity_select on public.reel_activity
  for select to authenticated
  using (
    exists (
      select 1 from public.reels r
      where r.id = reel_activity.reel_id
        and public.reel_can_read(r.smm_id, r.editor_id, r.reviewer_id)
    )
  );

grant select on public.reels, public.reel_versions, public.reel_notifications,
  public.reel_reminder_log, public.client_quota, public.reel_activity
  to authenticated;

revoke all on function public.reel_deadline(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.reel_same_person(text) from public, anon, authenticated;
revoke all on function public.reel_is_leadership() from public, anon, authenticated;
revoke all on function public.reel_leadership_ids() from public, anon, authenticated;
revoke all on function public.reel_can_plan() from public, anon, authenticated;
revoke all on function public.reel_can_read(text, text, text) from public, anon, authenticated;
revoke all on function public.reel_compute_risk(text, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.reel_require_url(text, text) from public, anon, authenticated;
revoke all on function public.reel_touch() from public, anon, authenticated;
revoke all on function public.reel_guard_transition() from public, anon, authenticated;
revoke all on function public.reel_log(text, text, text, text) from public, anon, authenticated;
revoke all on function public.reel_notify(text, text, text, text, text, boolean, text, text, boolean, text) from public, anon, authenticated;
revoke all on function public.reel_close_prompts(text, text) from public, anon, authenticated;
revoke all on function public.reel_next_unmet(text, text, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;
revoke all on function public.reel_scheduler_tick() from public, anon, authenticated;

grant execute on function public.reel_next_id(text, text) to authenticated;
grant execute on function public.reel_editor_workload(timestamptz) to authenticated;
grant execute on function public.reel_plan(text, text, text, text, text, text, text, text, text, timestamptz, text[], text[], text, text) to authenticated;
grant execute on function public.reel_start(text) to authenticated;
grant execute on function public.reel_add_version(text, text, text, text, bigint, text) to authenticated;
grant execute on function public.reel_decide(text, text, text) to authenticated;
grant execute on function public.reel_schedule(text, text, boolean, boolean) to authenticated;
grant execute on function public.reel_publish(text, text) to authenticated;
grant execute on function public.reel_set_golive(text, timestamptz) to authenticated;
grant execute on function public.reel_set_quota(text, text, integer) to authenticated;
grant execute on function public.reel_answer(text, text) to authenticated;
grant execute on function public.reel_on_time_scores(text) to authenticated;
grant execute on function public.reel_scheduler_tick() to service_role;

-- Policies call these. Authenticated needs execute, but they only report the caller.
grant execute on function public.reel_same_person(text) to authenticated;
grant execute on function public.reel_is_leadership() to authenticated;
grant execute on function public.reel_can_read(text, text, text) to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.reel_notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  perform cron.unschedule('reel-scheduler-tick');
exception when others then
  null;
end $$;

do $$
begin
  perform cron.schedule(
    'reel-scheduler-tick',
    '* * * * *',
    $job$select public.reel_scheduler_tick()$job$
  );
exception when others then
  raise notice 'reel scheduler cron not scheduled: %', sqlerrm;
end $$;
