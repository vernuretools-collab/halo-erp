-- Schedule reminders every 30 minutes, a 9:30 digest of today's work,
-- and one nudge when QC has waited more than one working day.

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
  v_workday boolean;
  v_risk text;
  v_leader text;
  v_smm text;
  v_today integer;
  v_schedule_today integer;
  v_qc integer;
  v_next_month text;
  v_planned integer;
  v_version integer;
  v_uploaded timestamptz;
  v_due timestamptz;
  q record;
begin
  perform set_config('reel.transition', 'on', true);
  v_local := now() at time zone 'Asia/Kolkata';
  v_mins := extract(hour from v_local)::integer * 60 + extract(minute from v_local)::integer;
  v_dow := extract(dow from v_local)::integer;
  v_workday := v_dow between 1 and 6;

  for r in select * from public.reels where status = 'ready_to_schedule' loop
    if r.last_reminder_at is null or now() - r.last_reminder_at >= interval '30 minutes' then
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

  for r in select * from public.reels where status = 'in_review' loop
    select version_no, uploaded_at
    into v_version, v_uploaded
    from public.reel_versions
    where reel_id = r.id
      and decision = 'pending'
    order by version_no desc
    limit 1;
    if v_uploaded is null then
      continue;
    end if;
    v_due := v_uploaded + interval '1 day';
    if extract(dow from (v_due at time zone 'Asia/Kolkata')) = 0 then
      v_due := v_due + interval '1 day';
    end if;
    if now() > v_due then
      perform public.reel_notify(
        r.smm_id, r.id, 'qc_waiting_v' || v_version::text,
        'QC is waiting',
        r.id || ' v' || v_version::text || ' has been in review for more than one working day.',
        false, 'bell', 'Open review', false, null
      );
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
          count(*) filter (where (golive_at at time zone 'Asia/Kolkata')::date = v_local::date),
          count(*) filter (
            where status <> 'scheduled'
              and (t3 at time zone 'Asia/Kolkata')::date = v_local::date
          ),
          count(*) filter (where status = 'in_review')
        into v_today, v_schedule_today, v_qc
        from public.reels
        where smm_id = v_smm and status <> 'published';
        perform public.reel_notify(
          v_smm, null, 'daily_digest_' || to_char(v_local::date, 'YYYY-MM-DD'),
          'Reel digest',
          v_today::text || ' going live today, ' || v_schedule_today::text || ' to schedule today, ' || v_qc::text || ' waiting on QC.',
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
