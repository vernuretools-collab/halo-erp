-- Editors upload the review file itself. A separate full-quality link is no longer required.

alter table public.reel_versions
  alter column full_quality_url drop not null;

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
  v_url text := nullif(btrim(coalesce(p_full_quality_url, '')), '');
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
