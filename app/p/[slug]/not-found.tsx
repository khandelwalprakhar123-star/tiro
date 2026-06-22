import Link from "next/link";

// Shown when a slug has no published page — either it was never published, or the
// owner unpublished it. Deliberately vague (we don't reveal whether a slug ever
// existed) and login-free.
export default function PublishedNotFound() {
  return (
    <main className="grain relative flex min-h-screen items-center justify-center bg-paper text-ink">
      <div className="relative z-10 mx-auto max-w-md px-8 text-center">
        <p className="font-display text-6xl text-ink">404</p>
        <h1 className="mt-4 text-xl text-ink">This page isn’t published</h1>
        <p className="mt-2 text-sm text-ink-soft">
          The link may be wrong, or the author may have unpublished it.
        </p>
        <Link
          href="https://tiro.works"
          className="mt-8 inline-block rounded-full border border-line px-5 py-2 text-sm text-ink-soft transition-colors hover:border-ink hover:text-ink"
        >
          Go to Tiro
        </Link>
      </div>
    </main>
  );
}
