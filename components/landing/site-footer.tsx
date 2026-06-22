import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[1.4fr_1fr_1fr] lg:px-10">
        <div className="max-w-sm">
          <Link
            href="/"
            className="font-display text-3xl tracking-tight text-ink"
            style={{ fontVariationSettings: "'opsz' 80, 'SOFT' 30, 'WONK' 1" }}
          >
            Tiro
          </Link>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            Named for Marcus Tullius Tiro — Cicero&rsquo;s scribe and the
            inventor of shorthand, who first turned fleeting speech into writing
            worth keeping.
          </p>
        </div>

        <nav aria-label="Product" className="text-sm">
          <h3 className="font-medium text-ink">Product</h3>
          <ul className="mt-4 flex flex-col gap-3 text-ink-soft">
            <li>
              <a href="#document" className="link-underline pb-0.5 hover:text-ink">
                The document
              </a>
            </li>
            <li>
              <a href="#media" className="link-underline pb-0.5 hover:text-ink">
                Media
              </a>
            </li>
            <li>
              <a href="#publish" className="link-underline pb-0.5 hover:text-ink">
                Publish &amp; export
              </a>
            </li>
          </ul>
        </nav>

        <nav aria-label="Get started" className="text-sm">
          <h3 className="font-medium text-ink">Get started</h3>
          <ul className="mt-4 flex flex-col gap-3 text-ink-soft">
            <li>
              <Link href="/login" className="link-underline pb-0.5 hover:text-ink">
                Start writing
              </Link>
            </li>
            <li>
              <Link href="/login" className="link-underline pb-0.5 hover:text-ink">
                Sign in
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-6 py-6 text-xs text-ink-soft sm:flex-row sm:items-center lg:px-10">
          <p>© {new Date().getFullYear()} Tiro · tiro.works</p>
          <p>Write with everything.</p>
        </div>
      </div>
    </footer>
  );
}
