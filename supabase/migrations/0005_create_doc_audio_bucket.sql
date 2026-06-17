-- Tiro — doc-audio storage bucket
--
-- Holds audio files inserted into documents. Mirrors the `doc-videos`/`doc-images`
-- bucket model exactly: public-READ (so a plain <audio src> plays for anyone with
-- the URL), but a user may only WRITE/UPDATE/DELETE files inside a top-level folder
-- named with their own auth uid. Objects are organised as  ‹uid›/‹docId›/‹id›.‹ext›
-- so a document purge can delete the whole audio set in one prefix sweep, exactly
-- like images and videos.
--
-- NOTE: unlike video, audio is NOT transcoded server-side. The original file is
-- uploaded as-is, and the waveform peaks are computed once in the uploader's
-- browser and stored on the figure (data-peaks) — no ffmpeg, no server compute.
-- So this bucket only ever holds the final audio object (no transient -raw file).
--
-- Safe to re-run: bucket upsert is idempotent; policies are dropped-then-created.

-- Per-object cap. 50 MB is generous for document audio (voice notes, clips); raise
-- if longer recordings are needed.
insert into storage.buckets (id, name, public, file_size_limit)
values ('doc-audio', 'doc-audio', true, 52428800)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit;

-- Public read — required for a plain <audio src> to load the file.
drop policy if exists "doc-audio public read" on storage.objects;
create policy "doc-audio public read"
  on storage.objects for select
  using (bucket_id = 'doc-audio');

-- Insert: only into your own ‹uid›/… folder.
drop policy if exists "doc-audio owner insert" on storage.objects;
create policy "doc-audio owner insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'doc-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update: only files in your own ‹uid›/… folder.
drop policy if exists "doc-audio owner update" on storage.objects;
create policy "doc-audio owner update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'doc-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Delete: only files in your own ‹uid›/… folder (keeps cleanup owner-scoped —
-- no one can delete another user's audio).
drop policy if exists "doc-audio owner delete" on storage.objects;
create policy "doc-audio owner delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'doc-audio'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
