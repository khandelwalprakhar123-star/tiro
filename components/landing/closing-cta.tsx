import Link from "next/link";

export function ClosingCTA() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="mx-auto max-w-4xl px-6 py-28 text-center lg:py-36"
        data-reveal
      >
        <h2
          className="font-display text-[clamp(2.75rem,8vw,6rem)] font-medium leading-[0.95] tracking-[-0.025em] text-ink"
          style={{
            fontVariationSettings: "'opsz' 144, 'SOFT' 40, 'WONK' 1",
            textWrap: "balance",
          }}
        >
          <span className="relative inline-block">
            Start writing
            {/* The motif, once more — re-draws as this scrolls into view. */}
            <svg
              aria-hidden
              viewBox="0 0 360 40"
              preserveAspectRatio="none"
              className="pointer-events-none absolute -bottom-3 left-0 h-5 w-full overflow-visible"
            >
              <path
                className="scribble-defer"
                pathLength={1}
                strokeWidth={4}
                d="M6 25 C 52 12, 92 34, 132 21 S 214 9, 256 25 S 336 33, 354 16"
              />
            </svg>
          </span>
          .
        </h2>

        <p className="mx-auto mt-8 max-w-md text-lg leading-relaxed text-ink-soft">
          Open a blank page and put everything on it. It&rsquo;s free, and
          there&rsquo;s no password — just a code in your inbox.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="group inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 text-base font-semibold tracking-wide text-paper transition-colors hover:bg-yolk-deep hover:text-ink"
          >
            Start writing
            <span className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-full border border-line px-7 py-4 text-base font-medium text-ink transition-colors hover:border-ink/40"
          >
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
