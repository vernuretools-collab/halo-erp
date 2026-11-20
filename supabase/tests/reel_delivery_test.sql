-- Plain SQL checks for reel delivery. pgTAP is not installed in this project.
-- The script creates ZZTEST reels, exercises upload and review, then deletes them.
-- Hiding an approved video in the player is not a database rule and is not asserted here.

CREATE TEMP TABLE IF NOT EXISTS reel_test_results (
  name text PRIMARY KEY,
  ok boolean NOT NULL,
  detail text NOT NULL
);

TRUNCATE reel_test_results;

DO $$
DECLARE
  v_editor constant text := 'kMfQ7Uh3S5dXtazmLZoKQyzfnxp2';
  v_editor_auth constant text := '35443036-028d-4abb-af46-c5fe99e4147e';
  v_editor_email constant text := 'daniel@thehaloeffectconsulting.com';
  v_smm_auth constant text := '98334548-344c-4896-ab11-b19e40ec39aa';
  v_smm_email constant text := 'saravanan@thehaloeffectconsulting.com';
  v_project text;
  v_golive timestamptz := now() + interval '10 days';
  v_version text;
  v_status text;
  v_url text;
  v_path text;
  v_qc text;
  v_err text;
BEGIN
  DELETE FROM public.qc_items WHERE reel_id LIKE 'ZZTEST-%';
  DELETE FROM public.reels WHERE id LIKE 'ZZTEST-%';

  SELECT id INTO v_project FROM public.projects LIMIT 1;
  IF v_project IS NULL THEN
    RAISE EXCEPTION 'Need at least one project to attach the test reel.';
  END IF;

  PERFORM set_config('reel.transition', 'on', true);
  INSERT INTO public.reels (
    id, project_id, title, raw_footage_url, editor_id, editor_name,
    smm_id, smm_name, reviewer_id, reviewer_name,
    golive_at, t7, t5, t4, t3, platforms, status
  ) VALUES (
    'ZZTEST-R001', v_project, 'SQL upload test', 'https://example.com/raw.mp4',
    v_editor, 'DANIEL D ''CRUZ B',
    v_smm_auth, 'Saravana R', v_smm_auth, 'Saravana R',
    v_golive, v_golive, v_golive, v_golive, v_golive, ARRAY['instagram'], 'todo'
  );

  PERFORM set_config('request.jwt.claim.sub', v_editor_auth, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_editor_auth, 'role', 'authenticated', 'email', v_editor_email)::text,
    true
  );

  PERFORM public.reel_start('ZZTEST-R001');
  SELECT status INTO v_status FROM public.reels WHERE id = 'ZZTEST-R001';
  INSERT INTO reel_test_results VALUES (
    'start moves a planned reel to in progress',
    v_status = 'in_progress',
    coalesce(v_status, 'missing')
  );

  BEGIN
    PERFORM public.reel_add_version(
      'ZZTEST-R001', 'ZZTEST-R001/v1-notes.txt', 'notes.txt', 'text/plain', 10, NULL
    );
    v_err := 'accepted a non-video file';
  EXCEPTION WHEN OTHERS THEN
    v_err := SQLERRM;
  END;
  INSERT INTO reel_test_results VALUES (
    'upload rejects a file that is not mp4 or webm',
    v_err ILIKE '%MP4 or WebM%',
    v_err
  );

  v_version := public.reel_add_version(
    'ZZTEST-R001',
    'ZZTEST-R001/v1-cut.mp4',
    'cut.mp4',
    'video/mp4',
    1024,
    NULL
  );
  SELECT r.status, v.full_quality_url, v.review_file_url, q.status
    INTO v_status, v_url, v_path, v_qc
  FROM public.reels r
  JOIN public.reel_versions v ON v.id = v_version
  JOIN public.qc_items q ON q.reel_id = r.id
  WHERE r.id = 'ZZTEST-R001';

  INSERT INTO reel_test_results VALUES (
    'send for review without a full-quality link',
    v_status = 'in_review' AND v_url IS NULL AND v_path = 'ZZTEST-R001/v1-cut.mp4' AND v_qc = 'in_review',
    format('status=%s url=%s path=%s qc=%s', v_status, v_url, v_path, v_qc)
  );

  PERFORM set_config('request.jwt.claim.sub', v_smm_auth, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_smm_auth, 'role', 'authenticated', 'email', v_smm_email)::text,
    true
  );
  PERFORM public.reel_decide('ZZTEST-R001', 'changes', 'Trim the opening.');
  SELECT r.status, v.decision, v.feedback, r.hide_video::text
    INTO v_status, v_url, v_path, v_qc
  FROM public.reels r
  JOIN public.reel_versions v ON v.reel_id = r.id
  WHERE r.id = 'ZZTEST-R001';
  INSERT INTO reel_test_results VALUES (
    'change request keeps the cut and records the note',
    v_status = 'changes_requested' AND v_url = 'changes' AND v_path = 'Trim the opening.' AND v_qc = 'false',
    format('status=%s decision=%s feedback=%s hide=%s', v_status, v_url, v_path, v_qc)
  );

  PERFORM set_config('reel.transition', 'on', true);
  INSERT INTO public.reels (
    id, project_id, title, raw_footage_url, editor_id, editor_name,
    smm_id, smm_name, reviewer_id, reviewer_name,
    golive_at, t7, t5, t4, t3, platforms, status
  ) VALUES (
    'ZZTEST-R002', v_project, 'SQL approval test', 'https://example.com/raw.mp4',
    v_editor, 'DANIEL D ''CRUZ B',
    v_smm_auth, 'Saravana R', v_smm_auth, 'Saravana R',
    v_golive, v_golive, v_golive, v_golive, v_golive, ARRAY['instagram'], 'in_progress'
  );

  PERFORM set_config('request.jwt.claim.sub', v_editor_auth, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_editor_auth, 'role', 'authenticated', 'email', v_editor_email)::text,
    true
  );
  v_version := public.reel_add_version(
    'ZZTEST-R002', 'ZZTEST-R002/v1-cut.mp4', 'cut.mp4', 'video/mp4', 2048, NULL
  );

  PERFORM set_config('request.jwt.claim.sub', v_smm_auth, true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_smm_auth, 'role', 'authenticated', 'email', v_smm_email)::text,
    true
  );
  PERFORM public.reel_decide('ZZTEST-R002', 'approved', '');

  SELECT r.status, v.review_file_url, q.status, r.hide_video::text
    INTO v_status, v_path, v_qc, v_err
  FROM public.reels r
  JOIN public.reel_versions v ON v.id = v_version
  JOIN public.qc_items q ON q.id = v.qc_item_id
  WHERE r.id = 'ZZTEST-R002';
  INSERT INTO reel_test_results VALUES (
    'approval keeps the video row and marks the review approved',
    v_status = 'ready_to_schedule' AND v_path = 'ZZTEST-R002/v1-cut.mp4' AND v_qc = 'approved',
    format('status=%s path=%s qc=%s', v_status, v_path, v_qc)
  );
  INSERT INTO reel_test_results VALUES (
    'approval sets hide_video',
    v_err = 'true',
    coalesce(v_err, 'missing')
  );

  DELETE FROM public.qc_items WHERE reel_id LIKE 'ZZTEST-%';
  DELETE FROM public.reel_notifications WHERE reel_id LIKE 'ZZTEST-%';
  DELETE FROM public.reel_activity WHERE reel_id LIKE 'ZZTEST-%';
  DELETE FROM public.reels WHERE id LIKE 'ZZTEST-%';
END $$;

SELECT name, ok, detail
FROM reel_test_results
ORDER BY name;
