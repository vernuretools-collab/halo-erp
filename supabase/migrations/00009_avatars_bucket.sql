-- Public profile photos so directory cards can load <img src> without
-- expiring signed URLs. Writes stay owner/admin-only.
-- Object paths: {uid}/avatar

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists storage_avatars_public_read on storage.objects;
drop policy if exists storage_avatars_owner_insert on storage.objects;
drop policy if exists storage_avatars_owner_update on storage.objects;
drop policy if exists storage_avatars_owner_delete on storage.objects;

create policy storage_avatars_public_read on storage.objects
  for select
  using (bucket_id = 'avatars');

create policy storage_avatars_owner_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = any (public.self_identity_ids())
    )
  );

create policy storage_avatars_owner_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'avatars'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = any (public.self_identity_ids())
    )
  )
  with check (
    bucket_id = 'avatars'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = any (public.self_identity_ids())
    )
  );

create policy storage_avatars_owner_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (
      public.is_admin()
      or (storage.foldername(name))[1] = any (public.self_identity_ids())
    )
  );
