import { RevealManager } from "./reveal-manager";
import { InkSpine } from "./ink-spine";
import { SiteNav } from "./site-nav";
import { Hero } from "./hero";
import { EditorMock } from "./editor-mock";
import { MediaShowcase } from "./media-showcase";
import { PublishBand } from "./publish-band";
import { AudienceTabs } from "./audience-tabs";
import { ClosingCTA } from "./closing-cta";
import { SiteFooter } from "./site-footer";

/** The marketing landing page, shown at `/` to logged-out visitors. */
export function Landing() {
  return (
    <div className="grain relative min-h-screen bg-paper text-ink">
      <RevealManager />
      <InkSpine />
      <div className="relative z-10">
        <SiteNav />
        <main>
          <Hero />

          {/* Proof — the same document, alive on the page. */}
          <section
            id="document"
            className="border-y border-line bg-paper-deep/40 py-24 lg:py-32"
          >
            <div className="mx-auto max-w-6xl px-6 lg:px-10">
              <div className="mx-auto max-w-2xl text-center" data-reveal>
                <h2
                  className="font-display text-[clamp(2rem,4.5vw,3.25rem)] font-medium leading-[1.02] tracking-[-0.02em] text-ink"
                  data-scrub
                >
                  It all lives on{" "}
                  <span className="relative inline-block whitespace-nowrap">
                    one page
                    {/* Underline that draws itself as the heading scrolls up. */}
                    <svg
                      aria-hidden
                      viewBox="0 0 220 30"
                      preserveAspectRatio="none"
                      className="pointer-events-none absolute -bottom-1.5 left-0 h-3.5 w-full overflow-visible"
                    >
                      <path
                        className="scribble-scrub"
                        pathLength={1}
                        strokeWidth={4}
                        d="M5 18 C 38 8, 64 24, 100 15 S 168 7, 196 21 S 214 18, 215 14"
                      />
                    </svg>
                  </span>
                  .
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
                  Not a doc tool bolted to three other apps. The words, the
                  photograph, the recording, the link — composed together, read
                  together. Here&rsquo;s a real Tiro document:
                </p>
              </div>

              {/* The paper sheet. */}
              <div
                className="mx-auto mt-14 max-w-[46rem] rounded-2xl border border-line bg-paper px-7 py-10 shadow-[0_40px_90px_-50px_rgba(33,28,20,0.65)] sm:px-12 sm:py-14"
                data-reveal
              >
                <EditorMock />
              </div>
            </div>
          </section>

          <MediaShowcase />
          <PublishBand />
          <AudienceTabs />
          <ClosingCTA />
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
