-- Already-applied databases do not re-run the delivery migration.
-- Approval sets reels.hide_video so the approved screen can hide the file.

alter table public.reels
  add column if not exists hide_video boolean not null default false;

update public.reels
set hide_video = true
where status in ('ready_to_schedule', 'scheduled', 'published');

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
