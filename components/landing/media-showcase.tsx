/* eslint-disable @next/next/no-img-element */
// Plain <img> to reuse the editor's `.doc-content` figure rules verbatim.

const MINI_PEAKS = [
  30, 54, 72, 46, 88, 60, 38, 66, 92, 70, 44, 58, 80, 50, 34, 62, 84, 56, 40,
  28, 48, 74, 64, 42,
];

/** Small "Media" section: one featured audio demo (Tiro's standout) plus a row
 *  of three compact demos. Sizes deliberately vary so it never reads as a
 *  uniform icon-card grid. */
export function MediaShowcase() {
  return (
    <section id="media" className="mx-auto max-w-6xl px-6 py-24 lg:px-10 lg:py-32">
      <div className="max-w-2xl" data-reveal>
        <h2 className="font-display text-[clamp(2rem,4.5vw,3.25rem)] font-medium leading-[1.02] tracking-[-0.02em] text-ink">
          Drop in the good stuff.
        </h2>
        <p className="mt-5 text-lg leading-relaxed text-ink-soft">
          Most editors make media an afterthought — an attachment, a link, a
          stiff embed. In Tiro it&rsquo;s native. Each kind of media gets its own
          first-class treatment.
        </p>
      </div>

      {/* Featured: real waveform audio. */}
      <div
        className="mt-14 grid items-center gap-10 rounded-2xl border border-line bg-paper-deep/50 p-8 lg:grid-cols-[0.85fr_1.15fr] lg:p-12"
        data-reveal
      >
        <div>
          <h3 className="font-display text-2xl text-ink">Audio with a real waveform</h3>
          <p className="mt-4 leading-relaxed text-ink-soft">
            Not a grey play-bar. Tiro decodes the clip and draws its actual
            shape, so a voice memo looks like what it sounds like — and you can
            scrub straight to the loud part.
          </p>
        </div>
        <div className="doc-content !text-base">
          <figure
            data-audio
            style={{ width: "100%", margin: 0, ["--played" as string]: "0.58" }}
          >
            <button type="button" data-audio-play data-playing aria-label="Pause clip" />
            <div data-waveform>
              <div data-bars>
                {MINI_PEAKS.map((h, i) => (
                  <span key={`b-${i}`} style={{ height: `${h}%` }} />
                ))}
              </div>
              <div data-bars-played aria-hidden>
                {MINI_PEAKS.map((h, i) => (
                  <span key={`p-${i}`} style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
            <span data-audio-time>0:21 / 0:36</span>
          </figure>
        </div>
      </div>

      {/* Three compact, visually distinct demos. */}
      <div className="mt-8 grid gap-8 md:grid-cols-3">
        {/* Images */}
        <div data-reveal>
          <div className="doc-content !text-base">
            <figure data-img data-align="center" style={{ width: "100%", margin: 0 }}>
              <img
                src="https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=80"
                alt="Sunbeams falling through a tall forest canopy"
                data-filter="sepia"
                style={{ borderRadius: "0.5rem", aspectRatio: "4 / 3", objectFit: "cover" }}
              />
            </figure>
          </div>
          <h3 className="mt-5 font-display text-xl text-ink">Images, art-directed</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Resize and align by dragging. Add a caption, flip it, or tint it —
            grayscale, sepia, contrast — without touching another app.
          </p>
        </div>

        {/* Video */}
        <div data-reveal style={{ ["--reveal-delay" as string]: "0.08s" }}>
          <div className="relative flex aspect-[4/3] items-center justify-center rounded-lg bg-ink">
            <span
              aria-hidden
              className="flex h-14 w-14 items-center justify-center rounded-full bg-paper/95"
            >
              <span className="ml-1 h-0 w-0 border-y-[10px] border-l-[16px] border-y-transparent border-l-ink" />
            </span>
            <span className="absolute bottom-3 right-3 rounded-full bg-paper/15 px-2.5 py-1 text-xs font-medium text-paper backdrop-blur-sm">
              16:9 · MP4
            </span>
          </div>
          <h3 className="mt-5 font-display text-xl text-ink">Video, no fuss</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Drop in an MP4 and it just plays — no transcoding pipeline, no
            plugins, no waiting on a server to bless your file.
          </p>
        </div>

        {/* Links */}
        <div data-reveal style={{ ["--reveal-delay" as string]: "0.16s" }}>
          <div className="doc-content !text-base">
            <figure data-link-card style={{ width: "100%", margin: 0, cursor: "default" }}>
              <div data-card-body>
                <div data-card-site>
                  <svg
                    data-favicon
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden
                    style={{ background: "var(--paper-deep)" }}
                  >
                    <rect x="2.5" y="3" width="11" height="10" rx="1.5" stroke="var(--ink-soft)" strokeWidth="1.1" />
                    <path d="M2.5 6h11" stroke="var(--ink-soft)" strokeWidth="1.1" />
                  </svg>
                  klim.co.nz
                </div>
                <div data-card-title>The making of a typeface</div>
                <div data-card-desc>
                  A long read on drawing letters — pasted as a URL, served as a
                  card.
                </div>
              </div>
            </figure>
          </div>
          <h3 className="mt-5 font-display text-xl text-ink">Links, unfurled</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Paste any URL and Tiro fetches the title, blurb, and thumbnail into a
            tidy card. YouTube and Vimeo become inline players.
          </p>
        </div>
      </div>
    </section>
  );
}
