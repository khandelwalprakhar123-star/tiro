-- DeeScribe — doc-images storage bucket
--
-- Holds images inserted into documents. Mirrors the `avatars` bucket model:
-- public-READ (so an <img src> renders for anyone with the URL), but a user may
-- only WRITE/UPDATE/DELETE files inside a top-level folder named with their own
-- auth uid. We organise objects as  ‹uid›/‹docId›/‹imageId›.webp  so that
-- purging a document can delete its whole ‹uid›/‹docId›/ prefix in one sweep.
--
-- Safe to re-run: bucket upsert is idempotent; policies are dropped-then-created.

insert into storage.buckets (id, name, public)
values ('doc-images', 'doc-images', true)
on conflict (id) do update set public = excluded.public;

-- Public read — required for plain <img src> to load the picture.
drop policy if exists "doc-images public read" on storage.objects;
create policy "doc-images public read"
  on storage.objects for select
  using (bucket_id = 'doc-images');

-- Insert: only into your own ‹uid›/… folder.
drop policy if exists "doc-images owner insert" on storage.objects;
create policy "doc-images owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'doc-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update: only files in your own ‹uid›/… folder.
drop policy if exists "doc-images owner update" on storage.objects;
create policy "doc-images owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'doc-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: only files in your own ‹uid›/… folder (this is what keeps cleanup
-- owner-scoped — no one can delete another user's images).
drop policy if exists "doc-images owner delete" on storage.objects;
create policy "doc-images owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'doc-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
