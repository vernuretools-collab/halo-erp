-- Editors on QC need every reel an SMM or admin planned, not only the
-- reel assigned to them. qc_can_read is an editor, an SMM, leadership, or an admin.

drop policy if exists reels_select on public.reels;
create policy reels_select on public.reels
  for select to authenticated
  using (
    public.reel_can_read(smm_id, editor_id, reviewer_id)
    or public.qc_can_read()
  );
