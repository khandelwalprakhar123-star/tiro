import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DocumentCard } from "@/app/workspace/document-card";
import { createDocumentInFolder } from "@/app/workspace/actions";
import { FolderTitle, DeleteFolderButton } from "./folder-controls";

export default async function FolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;

  const supabase = await createClient();
  // Local JWT verification (no network); the proxy did the authoritative check.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  // The folder itself (RLS-guarded; null if not ours or trashed).
  const { data: folder } = await supabase
    .from("folders")
    .select("id, name")
    .eq("id", folderId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!folder) redirect("/workspace");

  // Which documents are in this folder?
  const { data: folderLinks } = await supabase
    .from("document_folders")
    .select("document_id")
    .eq("folder_id", folderId);
  const docIds = (folderLinks ?? []).map((l) => l.document_id);

  // The documents (live only), all folders, and these docs' memberships.
  const [{ data: documents }, { data: folders }, { data: links }] =
    await Promise.all([
      docIds.length
        ? supabase
            .from("documents")
            .select("id, title, updated_at")
            .in("id", docIds)
            .is("deleted_at", null)
            .order("updated_at", { ascending: false })
        : Promise.resolve({ data: [] as { id: string; title: string; updated_at: string }[] }),
      supabase
        .from("folders")
        .select("id, name")
        .is("deleted_at", null)
        .order("name", { ascending: true }),
      docIds.length
        ? supabase
            .from("document_folders")
            .select("document_id, folder_id")
            .in("document_id", docIds)
        : Promise.resolve({ data: [] as { document_id: string; folder_id: string }[] }),
    ]);

  const memberMap = new Map<string, string[]>();
  for (const link of links ?? []) {
    const arr = memberMap.get(link.document_id) ?? [];
    arr.push(link.folder_id);
    memberMap.set(link.document_id, arr);
  }

  const allFolders = folders ?? [];

  return (
    <main className="grain relative min-h-screen bg-paper text-ink">
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-10">
        <header className="flex flex-wrap items-center justify-start gap-4">
          <Link
            href="/workspace"
            className="inline-flex items-center gap-2 text-sm text-ink-soft transition-colors hover:text-ink"
          >
            ← Back to desk
          </Link>
          <DeleteFolderButton folderId={folder.id} />
        </header>

        <section className="rise mt-10">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1">
              <p className="text-sm uppercase tracking-[0.2em] text-ink-soft">
                Folder
              </p>
              <div className="mt-2">
                <FolderTitle folderId={folder.id} initialName={folder.name} />
              </div>
            </div>

            {/* New document, created already filed into this folder. */}
            <form action={createDocumentInFolder.bind(null, folder.id)}>
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold tracking-wide text-paper transition-all hover:bg-yolk-deep hover:text-ink"
              >
                <span className="text-base leading-none">+</span> New document
              </button>
            </form>
          </div>

          {documents && documents.length > 0 ? (
            <ul className="mt-10 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {documents.map((doc) => (
                <li key={doc.id}>
                  <DocumentCard
                    doc={doc}
                    folders={allFolders}
                    memberFolderIds={memberMap.get(doc.id) ?? []}
                    currentFolderId={folder.id}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-10 rounded-xl border border-dashed border-line bg-paper-deep/40 px-6 py-12 text-center">
              <p className="text-ink-soft">This folder is empty.</p>
              <p className="mt-1 text-sm text-ink-soft">
                Add documents from the desk (⋯ menu → Add to folder), or create
                one here.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
