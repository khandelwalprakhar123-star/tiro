/* eslint-disable @next/next/no-img-element */
// Plain <img> on purpose: this mock reuses the editor's own `.doc-content`
// rules (globals.css), which target `figure[data-img] img` / link-card <img>
// directly. The real editor renders plain <img>, so we match it exactly rather
// than introducing next/image's wrapper and inline styles.

// A hand-shaped waveform (bar heights as % of the track). Static but lifelike;
// --played fills the first 42% in yolk, exactly like the real player.
const PEAKS = [
  22, 38, 30, 54, 70, 48, 86, 62, 40, 58, 92, 74, 50, 34, 46, 66, 80, 58, 36,
  28, 44, 72, 90, 64, 48, 30, 52, 68, 42, 26, 38, 60, 82, 70, 46, 32, 50, 64,
  44, 30, 24, 40, 56, 34,
];

/** A faithful, static recreation of a Tiro document, styled by the editor's
 *  own `.doc-content` rules (see globals.css) so it matches the real thing. */
export function EditorMock() {
  return (
    <div className="doc-content !text-base" data-mock>
      <h2>Iceland, day three</h2>
      <p>
        We left the ring road just after the rain stopped and the valley turned
        the colour of wet slate. I wanted to remember the sound of it more than
        the look — so I did both, right here on the page.
      </p>

      <figure data-img data-align="center" style={{ width: "78%" }}>
        <img
          src="https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80"
          alt="A still glacial lake mirroring dark mountains under a low Icelandic sky"
          style={{ borderRadius: "0.5rem" }}
        />
        <figcaption>Þingvellir, just before the light went.</figcaption>
      </figure>

      <p>
        Then the wind picked up over the water — twelve seconds of it, caught on
        the phone and dropped straight in:
      </p>

      {/* Audio embed — the real custom player markup + CSS. Paused, 42% in. */}
      <figure
        data-audio
        style={{ width: "100%", ["--played" as string]: "0.42" }}
      >
        <button type="button" data-audio-play aria-label="Play clip" />
        <div data-waveform>
          <div data-bars>
            {PEAKS.map((h, i) => (
              <span key={`b-${i}`} style={{ height: `${h}%` }} />
            ))}
          </div>
          <div data-bars-played aria-hidden>
            {PEAKS.map((h, i) => (
              <span key={`p-${i}`} style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        <span data-audio-time>1:12 / 2:48</span>
      </figure>

      <p>
        I read about the rift valley on the drive back. Paste a link and Tiro
        unrolls it into the page — no bare blue URL sitting there:
      </p>

      {/* Link-preview card — the real unfurl markup + CSS. */}
      <figure data-link-card style={{ width: "100%" }}>
        <div data-card-media>
          <img
            src="https://images.unsplash.com/photo-1506905925346-21bda4d32df4?auto=format&fit=crop&w=1200&q=80"
            alt="Snow-streaked mountains under a bright sky"
          />
        </div>
        <div data-card-body>
          <div data-card-site>
            <svg
              data-favicon
              viewBox="0 0 16 16"
              fill="none"
              aria-hidden
              style={{ background: "var(--paper-deep)" }}
            >
              <circle cx="8" cy="8" r="6" stroke="var(--ink-soft)" strokeWidth="1.1" />
              <path
                d="M2 8h12M8 2c1.8 1.6 1.8 10.4 0 12M8 2c-1.8 1.6-1.8 10.4 0 12"
                stroke="var(--ink-soft)"
                strokeWidth="1.1"
              />
            </svg>
            visitor.is
          </div>
          <div data-card-title>
            Þingvellir National Park — where two continents drift apart
          </div>
          <div data-card-desc>
            The only place on earth where the Mid-Atlantic Ridge rises above sea
            level, and the site of the world&rsquo;s oldest parliament.
          </div>
        </div>
      </figure>
    </div>
  );
}
