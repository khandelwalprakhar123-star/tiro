import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LogoutButton } from "./logout-button";
import { createDocument } from "./actions";
import { DocumentCard } from "./document-card";
import { FolderCard } from "./folder-card";
import { NewFolderButton } from "./new-folder-button";

export default async function WorkspacePage() {
  const supabase = await createClient();
  // Belt-and-suspenders: the proxy already guards this route with the
  // authoritative getUser(). Here we just verify the JWT locally (getClaims,
  // no network) so we never render a protected page without a session.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  // Live documents + folders + the doc↔folder links, all owner-scoped by RLS.
  const [{ data: documents }, { data: folders }, { data: links }] =
    await Promise.all([
      supabase
        .from("documents")
        .select("id, title, updated_at")
        .is("deleted_at", null)
        .order("updated_at", { ascending: false }),
      supabase
        .from("folders")
        .select("id, name, parent_id")
        .is("deleted_at", null)
        .order("name", { ascending: true }),
      supabase.from("document_folders").select("document_id, folder_id"),
    ]);

  // Map each document → the folders it belongs to (for the card menu).
  const memberMap = new Map<string, string[]>();
  for (const link of links ?? []) {
    const arr = memberMap.get(link.document_id) ?? [];
    arr.push(link.folder_id);
    memberMap.set(link.document_id, arr);
  }
  // Count documents per folder (shown on folder cards). Soft-deleted documents
  // keep their document_folders link rows, so we must count only links whose
  // document is still live — otherwise trashed docs inflate the count.
  const liveDocIds = new Set((documents ?? []).map((d) => d.id));
  const folderCounts = new Map<string, number>();
  for (const link of links ?? []) {
    if (!liveDocIds.has(link.document_id)) continue;
    folderCounts.set(link.folder_id, (folderCounts.get(link.folder_id) ?? 0) + 1);
  }

  const allFolders = folders ?? [];
  // The desk shows only top-level folders; nested ones appear inside their parent.
  const topFolders = allFolders.filter((f) => !f.parent_id);

  return (
    <main className="grain relative min-h-screen bg-paper text-ink">
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-16">
        <header className="rise flex flex-wrap items-center justify-between gap-y-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/trash"
              className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
            >
              Trash
            </Link>
            <Link
              href="/profile"
              className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
            >
              Profile
            </Link>
            <LogoutButton />
          </div>
          <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.3em] text-ink-soft">
            <span className="h-px w-8 bg-yolk-deep" />
            DeeScribe
          </p>
        </header>

        <section className="rise mt-16" style={{ animationDelay: "0.1s" }}>
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-ink-soft">
                Your desk
              </p>
              <h1
                className="mt-3 font-display text-4xl leading-[0.95] tracking-tight sm:text-5xl"
                style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 40, 'WONK' 1" }}
              >
                Documents
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <NewFolderButton />
              {/* Server Action: creates a doc and redirects into it. */}
              <form action={createDocument}>
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold tracking-wide text-paper transition-all hover:bg-yolk-deep hover:text-ink"
                >
                  <span className="text-base leading-none">+</span> New document
                </button>
              </form>
            </div>
          </div>

          {/* Folders */}
          {topFolders.length > 0 && (
            <>
              <h2 className="mt-12 text-xs font-medium uppercase tracking-[0.2em] text-ink-soft">
                Folders
              </h2>
              <ul className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                {topFolders.map((folder) => (
                  <li key={folder.id}>
                    <FolderCard
                      folder={folder}
                      docCount={folderCounts.get(folder.id) ?? 0}
                    />
                  </li>
                ))}
              </ul>
            </>
          )}

          {/* Documents */}
          <h2 className="mt-12 text-xs font-medium uppercase tracking-[0.2em] text-ink-soft">
            All documents
          </h2>
          {documents && documents.length > 0 ? (
            <ul className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
              {documents.map((doc) => (
                <li key={doc.id}>
                  <DocumentCard
                    doc={doc}
                    folders={allFolders}
                    memberFolderIds={memberMap.get(doc.id) ?? []}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-line bg-paper-deep/40 px-6 py-12 text-center">
              <p className="text-ink-soft">No documents yet.</p>
              <p className="mt-1 text-sm text-ink-soft">
                Hit <span className="font-medium text-ink">New document</span> to
                start writing.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
