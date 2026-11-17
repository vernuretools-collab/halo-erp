-- QC files are not capped at 50 MB. The project upload limit still applies.

update storage.buckets
set file_size_limit = null
where id = 'qc-media';
