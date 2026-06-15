-- DeeScribe — documents table (skeleton slice)
-- Applied via the Supabase dashboard SQL editor (MCP schema writes are denied).
-- Mirrors prd-vision.md §4.2. Folders / document_folders come in a later slice.

create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'Untitled',
  content     jsonb not null default '{}'::jsonb,  -- custom doc model later; {"plain": "..."} for now
  header      jsonb,                               -- optional running header (future)
  footer      jsonb,                               -- optional running footer (future)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz                          -- soft delete (trash); null = live
);

-- Fast "my live documents" lookups.
create index if not exists documents_owner_idx on public.documents (owner_id, updated_at desc);

-- Row-Level Security: a user may only see/modify their own documents.
alter table public.documents enable row level security;

-- drop-then-create so this migration is safe to re-run
drop policy if exists "documents_select_own" on public.documents;
create policy "documents_select_own" on public.documents
  for select using (owner_id = auth.uid());

drop policy if exists "documents_insert_own" on public.documents;
create policy "documents_insert_own" on public.documents
  for insert with check (owner_id = auth.uid());

drop policy if exists "documents_update_own" on public.documents;
create policy "documents_update_own" on public.documents
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "documents_delete_own" on public.documents;
create policy "documents_delete_own" on public.documents
  for delete using (owner_id = auth.uid());
