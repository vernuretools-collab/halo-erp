-- Pin a QC comment to a frame and store the drawing marks on that frame.

alter table public.qc_comments
  add column if not exists time_seconds double precision,
  add column if not exists timecode text,
  add column if not exists frame_number integer,
  add column if not exists shapes jsonb not null default '[]'::jsonb;

alter table public.qc_comments drop constraint if exists qc_comments_shapes_array;
alter table public.qc_comments
  add constraint qc_comments_shapes_array
  check (jsonb_typeof(shapes) = 'array' and jsonb_array_length(shapes) <= 60);
