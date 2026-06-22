import Link from "next/link";

/* A loose hand-drawn underline scribble (draws on under "everything"). */
function UnderlineScribble() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 320 38"
      preserveAspectRatio="none"
      className="pointer-events-none absolute -bottom-2 left-0 h-4 w-full overflow-visible"
    >
      <path
        className="scribble-path"
        pathLength={1}
        strokeWidth={4}
        style={{ animationDelay: "0.25s" }}
        d="M5 24 C 46 11, 78 33, 116 21 S 188 9, 224 25 S 292 33, 314 17"
      />
    </svg>
  );
}

/* Short squiggle used in the transformation panel rows. */
function RowScribble({ delay }: { delay: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 130 26"
      preserveAspectRatio="none"
      className="h-5 w-full overflow-visible"
    >
      <path
        className="scribble-path"
        pathLength={1}
        strokeWidth={3}
        style={{ animationDelay: delay }}
        d="M4 17 C 16 7, 28 23, 44 13 S 74 5, 92 17 S 116 21, 126 10"
      />
    </svg>
  );
}

const XFORM_ROWS = [
  { text: "Field notes", delay: 1.15 },
  { text: "a voice memo", delay: 1.5 },
  { text: "a photograph", delay: 1.85 },
  { text: "a link, unfurled", delay: 2.2 },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Oversized ghost wordmark bleeding off the right edge — echoes /login. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-[6vw] top-[8%] z-0 select-none font-display text-[34vw] leading-none text-ink/[0.035] lg:text-[26vw]"
        style={{ fontVariationSettings: "'opsz' 144, 'WONK' 1" }}
      >
        T.
      </div>

      <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-6 pb-20 pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:px-10 lg:pb-28 lg:pt-16">
        {/* Copy column */}
        <div>
          <h1
            className="font-display text-[clamp(2.75rem,7vw,5.25rem)] font-medium leading-[0.95] tracking-[-0.02em] text-ink"
            style={{
              fontVariationSettings: "'opsz' 144, 'SOFT' 40, 'WONK' 1",
              textWrap: "balance",
            }}
          >
            <span
              className="rise inline-block"
              style={{ animationDelay: "0.05s" }}
            >
              Write with
            </span>
            <br />
            <span className="relative inline-block whitespace-nowrap">
              <span
                className="swash absolute bottom-1 left-0 -z-10 h-[0.42em] w-full -rotate-1 bg-yolk/55"
                style={{ animationDelay: "1.05s" }}
                aria-hidden
              />
              <span
                className="ink-in inline-block"
                style={{ animationDelay: "0.45s" }}
              >
                everything
              </span>
              <UnderlineScribble />
            </span>
            <span className="rise inline-block" style={{ animationDelay: "0.1s" }}>
              .
            </span>
          </h1>

          <p
            className="rise mt-7 max-w-md text-lg leading-relaxed text-ink-soft"
            style={{ animationDelay: "0.85s" }}
          >
            Prose, images, audio, and video — composed in one document, then
            published as a web page or exported to PDF. The writing tool that
            doesn&rsquo;t make you leave to add the good stuff.
          </p>

          <div
            className="rise mt-9 flex flex-wrap items-center gap-3"
            style={{ animationDelay: "1s" }}
          >
            <Link
              href="/login"
              className="group inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-semibold tracking-wide text-paper transition-colors hover:bg-yolk-deep hover:text-ink"
            >
              Start writing
              <span className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
            <a
              href="#document"
              className="inline-flex items-center gap-2 rounded-full border border-line px-6 py-3.5 text-sm font-medium text-ink transition-colors hover:border-ink/40"
            >
              See how it works
              <span aria-hidden>↓</span>
            </a>
          </div>

          <p
            className="rise mt-5 text-sm text-ink-soft"
            style={{ animationDelay: "1.1s" }}
          >
            Free. A code in your inbox — no password to remember.
          </p>
        </div>

        {/* Transformation panel — the motif, abstracted: scribble → caret → type. */}
        <div
          className="rise"
          style={{ animationDelay: "0.55s" }}
          aria-hidden
        >
          <figure className="relative rounded-2xl border border-line bg-paper-deep/70 p-6 shadow-[0_30px_70px_-40px_rgba(33,28,20,0.55)] backdrop-blur-sm sm:p-8">
            <figcaption className="mb-5 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-ink-soft">
              <span className="h-px w-6 bg-yolk-deep" />
              Scribble becomes document
            </figcaption>

            <div className="flex flex-col gap-5">
              {XFORM_ROWS.map((row) => (
                <div key={row.text} className="xform-row">
                  <RowScribble delay={`${row.delay}s`} />
                  <span className="xform-caret caret-blink" />
                  <span
                    className="ink-in font-display text-lg text-ink sm:text-xl"
                    style={{ animationDelay: `${row.delay + 0.35}s` }}
                  >
                    {row.text}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-7 border-t border-line pt-5 text-sm leading-relaxed text-ink-soft">
              One page holds the words and the media — exactly as it&rsquo;ll be
              read.
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}
