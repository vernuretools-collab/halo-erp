-- Employee documents and payslips were served from public buckets, so any
-- unauthenticated caller holding the URL could read them. Make those two
-- private and scope objects to the owning folder. `deliverables` stays public
-- because those links are deliberately shared with clients.

update storage.buckets set public = false where id in ('employees', 'payslips');
update storage.buckets set public = true where id = 'deliverables';

drop policy if exists storage_auth_read on storage.objects;
drop policy if exists storage_auth_write on storage.objects;
drop policy if exists storage_deliverables on storage.objects;
drop policy if exists storage_employees_owner on storage.objects;
drop policy if exists storage_payslips_owner on storage.objects;

create policy storage_deliverables on storage.objects
  for all to authenticated
  using (bucket_id = 'deliverables')
  with check (bucket_id = 'deliverables');

-- Paths are `employees/{uid}/documents/{filename}`, so foldername()[1] is the
-- owning business id. Admins retain full access for the document manager.
create policy storage_employees_owner on storage.objects
  for all to authenticated
  using (
    bucket_id = 'employees'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = any (public.self_identity_ids())
    )
  )
  with check (
    bucket_id = 'employees'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = any (public.self_identity_ids())
    )
  );

create policy storage_payslips_owner on storage.objects
  for all to authenticated
  using (
    bucket_id = 'payslips'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = any (public.self_identity_ids())
    )
  )
  with check (
    bucket_id = 'payslips'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = any (public.self_identity_ids())
    )
  );
