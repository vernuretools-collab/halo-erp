-- QC reviews are not tied to a project.

alter table public.qc_items
  alter column project_id drop not null;
