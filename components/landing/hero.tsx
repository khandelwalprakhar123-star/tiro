/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

/* A loose hand-drawn underline scribble (draws on under "everything"). Pure ink
   flourish — emphasis, the way you'd underline a word on paper. */
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

// Bar heights for the mini waveform (% of track). The first ~38% renders in
// yolk, exactly like Tiro's real audio player.
const MINI_WAVE = [
  34, 56, 42, 70, 88, 60, 46, 74, 92, 66, 50, 38, 58, 80, 64, 44, 30, 52, 72,
  86, 60, 40,
];
const PLAYED = 0.38;

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
            A text editor where the photograph, the voice memo, the video, and
            the link live <em className="not-italic text-ink">inside</em> the
            writing — composed on one page, then published to the web or
            exported to PDF.
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
              See a real document
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

        {/* What Tiro actually is: prose and media interleaved on one page. An
            abstracted mini-document — text as ink rules, media as the real
            affordances — that assembles itself a beat after the headline. */}
        <div className="rise" style={{ animationDelay: "0.55s" }} aria-hidden>
          <figure className="relative rounded-2xl border border-line bg-paper-deep/70 p-6 shadow-[0_30px_70px_-40px_rgba(33,28,20,0.55)] backdrop-blur-sm sm:p-7">
            <figcaption className="mb-6 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-ink-soft">
              <span className="h-px w-6 bg-yolk-deep" />
              One page, every medium
            </figcaption>

            <div className="flex flex-col gap-4">
              {/* Heading + prose (text) */}
              <div className="rise" style={{ animationDelay: "0.85s" }}>
                <div className="h-2.5 w-2/5 rounded-full bg-ink/75" />
                <div className="mt-3 flex flex-col gap-2">
                  <div className="h-2 w-full rounded-full bg-ink/15" />
                  <div className="h-2 w-[92%] rounded-full bg-ink/15" />
                  <div className="h-2 w-3/4 rounded-full bg-ink/15" />
                </div>
              </div>

              {/* Image */}
              <div
                className="rise overflow-hidden rounded-lg"
                style={{ animationDelay: "1s" }}
              >
                <img
                  src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=640&q=70"
                  alt=""
                  className="h-24 w-full object-cover"
                />
              </div>

              {/* Audio — a real waveform shape, paused partway through */}
              <div
                className="rise flex items-center gap-3 rounded-lg border border-line bg-paper/70 px-3 py-2.5"
                style={{ animationDelay: "1.12s" }}
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink">
                  <span className="ml-0.5 h-0 w-0 border-y-[5px] border-l-[8px] border-y-transparent border-l-paper" />
                </span>
                <span className="flex h-7 flex-1 items-end gap-[2px]">
                  {MINI_WAVE.map((h, i) => (
                    <span
                      key={i}
                      className="flex-1 rounded-full"
                      style={{
                        height: `${h}%`,
                        background:
                          i / MINI_WAVE.length < PLAYED
                            ? "var(--yolk-deep)"
                            : "color-mix(in srgb, var(--ink) 22%, transparent)",
                      }}
                    />
                  ))}
                </span>
                <span className="shrink-0 text-[0.7rem] tabular-nums text-ink-soft">
                  0:36
                </span>
              </div>

              {/* Link, unfurled */}
              <div
                className="rise flex items-center gap-3 rounded-lg border border-line bg-paper/70 p-2"
                style={{ animationDelay: "1.24s" }}
              >
                <span className="h-9 w-9 shrink-0 rounded bg-ink/10" />
                <span className="min-w-0">
                  <span className="block truncate text-[0.8rem] font-medium text-ink">
                    The making of a typeface
                  </span>
                  <span className="block truncate text-[0.7rem] text-ink-soft">
                    klim.co.nz
                  </span>
                </span>
              </div>
            </div>

            <div className="mt-6 border-t border-line pt-4 text-sm leading-relaxed text-ink-soft">
              Words and media, composed together — exactly as they&rsquo;ll be
              read.
            </div>
          </figure>
        </div>
      </div>
    </section>
  );
}
