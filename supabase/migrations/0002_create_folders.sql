-- DeeScribe — folders + document↔folder links (organise slice)
-- Run in the Supabase dashboard SQL editor. Mirrors prd-vision.md §4.1–4.3.
-- Safe to re-run (IF NOT EXISTS / drop-then-create policies).

-- Folders ------------------------------------------------------------------
create table if not exists public.folders (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'Untitled folder',
  parent_id   uuid references public.folders(id) on delete cascade, -- nesting (future)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz                                           -- soft delete
);

create index if not exists folders_owner_idx on public.folders (owner_id, updated_at desc);

alter table public.folders enable row level security;

drop policy if exists "folders_select_own" on public.folders;
create policy "folders_select_own" on public.folders
  for select using (owner_id = auth.uid());

drop policy if exists "folders_insert_own" on public.folders;
create policy "folders_insert_own" on public.folders
  for insert with check (owner_id = auth.uid());

drop policy if exists "folders_update_own" on public.folders;
create policy "folders_update_own" on public.folders
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists "folders_delete_own" on public.folders;
create policy "folders_delete_own" on public.folders
  for delete using (owner_id = auth.uid());

-- Document ↔ Folder links (many-to-many) -----------------------------------
create table if not exists public.document_folders (
  document_id uuid not null references public.documents(id) on delete cascade,
  folder_id   uuid not null references public.folders(id) on delete cascade,
  added_at    timestamptz not null default now(),
  primary key (document_id, folder_id)
);

create index if not exists document_folders_folder_idx on public.document_folders (folder_id);

alter table public.document_folders enable row level security;

-- A link is yours only if you own BOTH the document and the folder.
drop policy if exists "df_select_own" on public.document_folders;
create policy "df_select_own" on public.document_folders
  for select using (
    exists (select 1 from public.documents d
            where d.id = document_id and d.owner_id = auth.uid())
  );

drop policy if exists "df_insert_own" on public.document_folders;
create policy "df_insert_own" on public.document_folders
  for insert with check (
    exists (select 1 from public.documents d
            where d.id = document_id and d.owner_id = auth.uid())
    and exists (select 1 from public.folders f
            where f.id = folder_id and f.owner_id = auth.uid())
  );

drop policy if exists "df_delete_own" on public.document_folders;
create policy "df_delete_own" on public.document_folders
  for delete using (
    exists (select 1 from public.documents d
            where d.id = document_id and d.owner_id = auth.uid())
  );
