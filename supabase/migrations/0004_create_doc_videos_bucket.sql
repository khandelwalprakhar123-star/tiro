-- Tiro — doc-videos storage bucket
--
-- Holds videos inserted into documents. Mirrors the `doc-images` bucket model:
-- public-READ (so a <video src> plays for anyone with the URL), but a user may
-- only WRITE/UPDATE/DELETE files inside a top-level folder named with their own
-- auth uid. We organise objects as  ‹uid›/‹docId›/‹id›.mp4  (compressed) plus a
-- ‹uid›/‹docId›/‹id›.jpg poster and a transient ‹uid›/‹docId›/‹id›-raw.‹ext›
-- original (deleted by the server action right after it finishes encoding). The
-- ‹uid›/‹docId›/ prefix lets a document purge delete its whole video set in one
-- sweep, exactly like images.
--
-- Safe to re-run: bucket upsert is idempotent; policies are dropped-then-created.

-- A generous per-object cap (raw uploads land here before compression). 500 MB.
insert into storage.buckets (id, name, public, file_size_limit)
values ('doc-videos', 'doc-videos', true, 524288000)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- Public read — required for a plain <video src> to load the file.
drop policy if exists "doc-videos public read" on storage.objects;
create policy "doc-videos public read"
  on storage.objects for select
  using (bucket_id = 'doc-videos');

-- Insert: only into your own ‹uid›/… folder.
drop policy if exists "doc-videos owner insert" on storage.objects;
create policy "doc-videos owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'doc-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update: only files in your own ‹uid›/… folder.
drop policy if exists "doc-videos owner update" on storage.objects;
create policy "doc-videos owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'doc-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: only files in your own ‹uid›/… folder (keeps cleanup owner-scoped —
-- no one can delete another user's videos).
drop policy if exists "doc-videos owner delete" on storage.objects;
create policy "doc-videos owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'doc-videos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
