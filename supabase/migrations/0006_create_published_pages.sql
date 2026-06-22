-- Tiro — published_pages table (Publish-to-Web)
--
-- A document becomes publicly viewable at  <slug>.tiro.works  by getting a row
-- here. This table is the ONLY thing an anonymous visitor can read: it holds a
-- *snapshot* of the document (title + content HTML) taken at publish time, never
-- the private `documents` row. Re-publishing overwrites the snapshot; unpublishing
-- deletes the row (and the subdomain 404s again).
--
-- Why a separate table instead of an anon policy on `documents`:
--   * `documents` stays fully private (owner-only RLS, unchanged) — we never widen
--     it to the `anon` role.
--   * The public surface is an explicit, minimal projection (slug/title/content).
--   * Snapshot semantics fall out naturally: editing the doc doesn't touch the
--     public copy until the owner re-publishes.
--
-- Media (images/video/audio inside the HTML) already lives in public-read buckets,
-- so those URLs keep working for logged-out visitors with no extra policy here.
--
-- Safe to re-run: table is IF NOT EXISTS; policies are dropped-then-created.

create table if not exists public.published_pages (
  slug         text primary key,                                   -- the subdomain label: <slug>.tiro.works
  document_id  uuid not null references public.documents(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  title        text not null default 'Untitled',
  content      jsonb not null default '{}'::jsonb,                 -- snapshot: { version: 2, html }
  published_at timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One published page per document. Makes "is this doc published?" a single lookup
-- and lets re-publish be an upsert keyed on document_id.
create unique index if not exists published_pages_document_idx
  on public.published_pages (document_id);

alter table public.published_pages enable row level security;

-- READ: public by design — anyone (including the anonymous `anon` role used by a
-- logged-out visitor) may read any published page. That is the whole point.
drop policy if exists "published_pages public read" on public.published_pages;
create policy "published_pages public read" on public.published_pages
  for select using (true);

-- WRITE is owner-only. A user may publish/update/unpublish only their own pages,
-- and only for documents they own (the document_id must belong to them).
drop policy if exists "published_pages owner insert" on public.published_pages;
create policy "published_pages owner insert" on public.published_pages
  for insert to authenticated
  with check (
    owner_id = auth.uid()
    and exists (
      select 1 from public.documents d
      where d.id = document_id and d.owner_id = auth.uid()
    )
  );

drop policy if exists "published_pages owner update" on public.published_pages;
create policy "published_pages owner update" on public.published_pages
  for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

drop policy if exists "published_pages owner delete" on public.published_pages;
create policy "published_pages owner delete" on public.published_pages
  for delete to authenticated
  using (owner_id = auth.uid());
