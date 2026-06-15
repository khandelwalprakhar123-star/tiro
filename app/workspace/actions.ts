"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// All actions are POST-reachable, so each re-checks auth. RLS is the real
// guarantee; the auth check just fails fast / avoids null owner_id.
async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

const DOC_IMAGES = "doc-images";

// Permanently remove every image a document stored. Images live under the
// flat prefix  ‹uid›/‹docId›/…  so one list + one remove clears them all. Used
// only on HARD delete (purge / empty trash) — soft delete keeps them for
// restore. Best-effort: storage errors are swallowed so a stuck file can't
// block the DB purge (a stray object is far less bad than an undeletable doc).
async function purgeDocImages(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  docId: string,
) {
  const prefix = `${userId}/${docId}`;
  const { data: files } = await supabase.storage.from(DOC_IMAGES).list(prefix);
  if (files && files.length > 0) {
    await supabase.storage
      .from(DOC_IMAGES)
      .remove(files.map((f) => `${prefix}/${f.name}`));
  }
}

// ── Documents ────────────────────────────────────────────────────────────
export async function createDocument() {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("documents")
    .insert({ owner_id: user.id, title: "Untitled", content: { plain: "" } })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  redirect(`/doc/${data.id}`);
}

// Create a document already filed into a folder.
export async function createDocumentInFolder(folderId: string) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("documents")
    .insert({ owner_id: user.id, title: "Untitled", content: { plain: "" } })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const { error: linkError } = await supabase
    .from("document_folders")
    .insert({ document_id: data.id, folder_id: folderId });
  if (linkError) throw new Error(linkError.message);

  redirect(`/doc/${data.id}`);
}

export async function deleteDocument(documentId: string) {
  const { supabase } = await requireUser();
  // Soft delete — set deleted_at; the row (and its folder links) stay so it can
  // be restored from /trash.
  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", documentId);
  if (error) throw new Error(error.message);
  revalidatePath("/workspace");
  revalidatePath("/trash");
}

// Bring a soft-deleted document back to life (clears deleted_at). Its folder
// links were never removed, so it reappears in any folders it was in.
export async function restoreDocument(documentId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: null })
    .eq("id", documentId);
  if (error) throw new Error(error.message);
  revalidatePath("/workspace");
  revalidatePath("/trash");
}

// Permanently delete a document (hard DELETE). The document_folders links are
// removed automatically by the `on delete cascade` FK in migration 0002.
export async function purgeDocument(documentId: string) {
  const { supabase, user } = await requireUser();
  // Sweep its images from storage first, so we never orphan files.
  await purgeDocImages(supabase, user.id, documentId);
  const { error } = await supabase
    .from("documents")
    .delete()
    .eq("id", documentId);
  if (error) throw new Error(error.message);
  revalidatePath("/trash");
}

// ── Folders ──────────────────────────────────────────────────────────────
export async function createFolder(name: string) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("folders")
    .insert({ owner_id: user.id, name: name.trim() || "Untitled folder" });
  if (error) throw new Error(error.message);
  revalidatePath("/workspace");
}

export async function renameFolder(folderId: string, name: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("folders")
    .update({ name: name.trim() || "Untitled folder", updated_at: new Date().toISOString() })
    .eq("id", folderId);
  if (error) throw new Error(error.message);
  revalidatePath("/workspace");
  revalidatePath(`/folders/${folderId}`);
}

// Nest one folder inside another (drag-and-drop). parentId = null moves it back
// to the top level (the desk). Guards against cycles: you can't drop a folder
// into one of its own descendants.
export async function moveFolderIntoFolder(
  folderId: string,
  parentId: string | null,
) {
  const { supabase } = await requireUser();
  if (folderId === parentId) return; // no-op: into itself

  if (parentId) {
    // Walk up from the target's ancestors; if we meet folderId, it's a cycle.
    const { data: all } = await supabase
      .from("folders")
      .select("id, parent_id")
      .is("deleted_at", null);
    const parentOf = new Map((all ?? []).map((f) => [f.id, f.parent_id]));
    let cursor: string | null = parentId;
    while (cursor) {
      if (cursor === folderId) {
        throw new Error("Can't move a folder into its own subfolder.");
      }
      cursor = parentOf.get(cursor) ?? null;
    }
  }

  const { error } = await supabase
    .from("folders")
    .update({ parent_id: parentId, updated_at: new Date().toISOString() })
    .eq("id", folderId);
  if (error) throw new Error(error.message);
  revalidatePath("/workspace");
  if (parentId) revalidatePath(`/folders/${parentId}`);
  revalidatePath(`/folders/${folderId}`);
}

export async function deleteFolder(folderId: string) {
  const { supabase } = await requireUser();
  // Soft delete the folder. Documents inside are NOT deleted — they just lose
  // this folder view (their other folders / All Documents are unaffected).
  const { error } = await supabase
    .from("folders")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", folderId);
  if (error) throw new Error(error.message);
  redirect("/workspace");
}

// Bring a soft-deleted folder back (clears deleted_at). Its document_folders
// links were left intact, so its documents are still filed into it.
export async function restoreFolder(folderId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("folders")
    .update({ deleted_at: null })
    .eq("id", folderId);
  if (error) throw new Error(error.message);
  revalidatePath("/workspace");
  revalidatePath("/trash");
}

// Permanently delete a folder (hard DELETE). Its document_folders links cascade
// away (the documents themselves are untouched). NOTE: folders.parent_id is also
// `on delete cascade`, so any *nested* subfolders would be deleted too — nested
// folders have no full UI yet, so this is an accepted limitation for now.
export async function purgeFolder(folderId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("folders")
    .delete()
    .eq("id", folderId);
  if (error) throw new Error(error.message);
  revalidatePath("/trash");
}

// ── Trash ──────────────────────────────────────────────────────────────────
// Permanently delete EVERYTHING currently in the trash (all soft-deleted docs
// and folders for this user). RLS scopes the deletes to the current user.
export async function emptyTrash() {
  const { supabase, user } = await requireUser();
  // Find the docs about to be purged so we can clear their images from storage.
  const { data: deadDocs } = await supabase
    .from("documents")
    .select("id")
    .not("deleted_at", "is", null);
  for (const d of deadDocs ?? []) {
    await purgeDocImages(supabase, user.id, d.id);
  }
  const [{ error: docErr }, { error: folderErr }] = await Promise.all([
    supabase.from("documents").delete().not("deleted_at", "is", null),
    supabase.from("folders").delete().not("deleted_at", "is", null),
  ]);
  if (docErr) throw new Error(docErr.message);
  if (folderErr) throw new Error(folderErr.message);
  revalidatePath("/trash");
  revalidatePath("/workspace");
}

// ── Document ↔ Folder membership ───────────────────────────────────────────
export async function addDocToFolder(documentId: string, folderId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("document_folders")
    .upsert(
      { document_id: documentId, folder_id: folderId },
      { onConflict: "document_id,folder_id", ignoreDuplicates: true },
    );
  if (error) throw new Error(error.message);
  revalidatePath("/workspace");
  revalidatePath(`/folders/${folderId}`);
}

export async function removeDocFromFolder(documentId: string, folderId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("document_folders")
    .delete()
    .eq("document_id", documentId)
    .eq("folder_id", folderId);
  if (error) throw new Error(error.message);
  revalidatePath("/workspace");
  revalidatePath(`/folders/${folderId}`);
}
