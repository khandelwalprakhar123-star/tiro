/* eslint-disable @next/next/no-img-element */
import Link from "next/link";

const FORMATS = [
  { label: "A web page", sub: "name.tiro.works" },
  { label: "PDF", sub: "print-perfect" },
  { label: "Markdown", sub: "portable text" },
];

/** Drenched-ink band — the bold contrast break against the paper. Continues
 *  the Iceland document from the proof section: now it's live on the web. */
export function PublishBand() {
  return (
    <section id="publish" className="relative bg-ink text-paper">
      <div className="mx-auto grid max-w-6xl items-center gap-14 px-6 py-24 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:px-10 lg:py-32">
        {/* Copy */}
        <div data-reveal>
          <h2 className="font-display text-[clamp(2.25rem,5vw,3.75rem)] font-medium leading-[1] tracking-[-0.02em] text-paper">
            Then publish it
            <br />
            <span className="relative inline-block">
              to the world
              <span aria-hidden className="absolute -bottom-1 left-0 h-2.5 w-full -rotate-1 bg-yolk/80" />
            </span>
            .
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-paper/80">
            One click turns your document into a public page at your own
            <span className="text-paper"> name.tiro.works</span> — media and
            all, no login for readers. Or take it with you as a PDF or Markdown.
          </p>

          <ul className="mt-9 flex flex-wrap gap-3">
            {FORMATS.map((f) => (
              <li
                key={f.label}
                className="rounded-xl border border-paper/15 bg-paper/[0.06] px-4 py-3"
              >
                <span className="block text-sm font-semibold text-paper">
                  {f.label}
                </span>
                <span className="mt-0.5 block text-xs text-paper/65">
                  {f.sub}
                </span>
              </li>
            ))}
          </ul>

          <Link
            href="/login"
            className="group mt-10 inline-flex items-center gap-2 rounded-full bg-yolk px-7 py-3.5 text-sm font-semibold tracking-wide text-ink transition-colors hover:bg-paper"
          >
            Publish your first page
            <span className="transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </Link>
        </div>

        {/* Browser-chrome mock of the published page. */}
        <div data-reveal style={{ ["--reveal-delay" as string]: "0.1s" }}>
          <div className="browser-mock">
            {/* Chrome */}
            <div className="flex items-center gap-3 border-b border-line bg-paper-deep px-4 py-3">
              <div className="flex gap-1.5" aria-hidden>
                <span className="h-3 w-3 rounded-full bg-ink/15" />
                <span className="h-3 w-3 rounded-full bg-ink/15" />
                <span className="h-3 w-3 rounded-full bg-ink/15" />
              </div>
              <div className="flex flex-1 items-center gap-2 rounded-full border border-line bg-paper px-3 py-1.5 text-xs text-ink-soft">
                <span aria-hidden className="text-yolk-deep">⬤</span>
                <span className="font-medium text-ink">leona</span>.tiro.works
              </div>
            </div>
            {/* Published article */}
            <article className="px-6 py-7 sm:px-9 sm:py-9">
              <p className="text-xs font-medium uppercase tracking-[0.22em] text-ink-soft">
                Leona Vance · Travel notes
              </p>
              <h3
                className="mt-3 font-display text-3xl leading-tight tracking-[-0.01em] text-ink"
                style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 30, 'WONK' 1" }}
              >
                Iceland, day three
              </h3>
              <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-soft">
                We left the ring road just after the rain stopped and the valley
                turned the colour of wet slate…
              </p>
              <img
                src="https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1000&q=80"
                alt="A still glacial lake mirroring dark mountains under a low Icelandic sky"
                className="mt-5 aspect-[16/10] w-full rounded-lg object-cover"
              />
              <p className="mt-4 text-[0.95rem] leading-relaxed text-ink-soft">
                I wanted to remember the sound of it more than the look…
              </p>
            </article>
          </div>
        </div>
      </div>
    </section>
  );
}
