import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TrashCard } from "./trash-card";
import { EmptyTrashButton } from "./empty-trash-button";

export default async function TrashPage() {
  const supabase = await createClient();
  // Local JWT verification (no network); the proxy did the authoritative check.
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  // The mirror image of every other view: everything WITH a deleted_at.
  const [{ data: documents }, { data: folders }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("folders")
      .select("id, name, deleted_at")
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
  ]);

  const docs = documents ?? [];
  const dirs = folders ?? [];
  const isEmpty = docs.length === 0 && dirs.length === 0;

  return (
    <main className="grain relative min-h-screen bg-paper text-ink">
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-10 sm:px-8 sm:py-16">
        <header className="rise flex flex-wrap items-center justify-between gap-y-4">
          <Link
            href="/workspace"
            className="rounded-full border border-line px-4 py-1.5 text-sm text-ink-soft transition-colors hover:border-ink/40 hover:text-ink"
          >
            ← Back to desk
          </Link>
          <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.3em] text-ink-soft">
            <span className="h-px w-8 bg-yolk-deep" />
            Tiro
          </p>
        </header>

        <section className="rise mt-16" style={{ animationDelay: "0.1s" }}>
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-ink-soft">
                Deleted items
              </p>
              <h1
                className="mt-3 font-display text-4xl leading-[0.95] tracking-tight sm:text-5xl"
                style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 40, 'WONK' 1" }}
              >
                Trash
              </h1>
            </div>
            {!isEmpty && <EmptyTrashButton />}
          </div>

          {isEmpty ? (
            <div className="mt-12 rounded-xl border border-dashed border-line bg-paper-deep/40 px-6 py-12 text-center">
              <p className="text-ink-soft">Trash is empty.</p>
              <p className="mt-1 text-sm text-ink-soft">
                Deleted documents and folders will appear here.
              </p>
            </div>
          ) : (
            <>
              {dirs.length > 0 && (
                <>
                  <h2 className="mt-12 text-xs font-medium uppercase tracking-[0.2em] text-ink-soft">
                    Folders
                  </h2>
                  <ul className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                    {dirs.map((f) => (
                      <li key={f.id}>
                        <TrashCard
                          kind="folder"
                          item={{
                            id: f.id,
                            label: f.name || "Untitled folder",
                            deleted_at: f.deleted_at,
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {docs.length > 0 && (
                <>
                  <h2 className="mt-12 text-xs font-medium uppercase tracking-[0.2em] text-ink-soft">
                    Documents
                  </h2>
                  <ul className="mt-4 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
                    {docs.map((d) => (
                      <li key={d.id}>
                        <TrashCard
                          kind="doc"
                          item={{
                            id: d.id,
                            label: d.title || "Untitled",
                            deleted_at: d.deleted_at,
                          }}
                        />
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
