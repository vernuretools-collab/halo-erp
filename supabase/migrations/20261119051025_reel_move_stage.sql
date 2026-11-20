-- The board can move a reel among the editing stages. Later stages stay on
-- schedule and publish. The status guard still blocks a direct table update.

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
end;
$$;

revoke all on function public.reel_move_stage(text, text) from public, anon;
grant execute on function public.reel_move_stage(text, text) to authenticated;
