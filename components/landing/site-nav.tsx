"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "#document", label: "The document" },
  { href: "#media", label: "Media" },
  { href: "#publish", label: "Publish" },
];

/**
 * Sticky top nav. Transparent over the hero; once the page scrolls it gains a
 * hairline border and a faint paper backdrop so it stays legible over content.
 */
export function SiteNav() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-30 transition-colors duration-300 ${
        scrolled
          ? "border-b border-line bg-paper/85 backdrop-blur-md"
          : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-6 py-4 lg:px-10">
        <Link
          href="/"
          className="font-display text-2xl tracking-tight text-ink"
          style={{ fontVariationSettings: "'opsz' 80, 'SOFT' 30, 'WONK' 1" }}
        >
          Tiro
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="link-underline pb-0.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/login"
            className="hidden text-sm font-medium text-ink-soft transition-colors hover:text-ink sm:inline"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="group inline-flex items-center gap-1.5 rounded-full bg-ink px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-yolk-deep hover:text-ink"
          >
            Start writing
            <span className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
