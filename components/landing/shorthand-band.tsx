import Link from "next/link";
import { GoMarcoIcon } from "@/components/icons";

/* ── Marco data ─────────────────────────────────────────────────────────────
   Every shipped marco, grouped. `arg` renders as a ‹placeholder› inside the
   key chip (e.g. `f ‹name›`). Keep this in sync with runMarco() in the editor
   and prd.md §15. */
type Marco = { code: string; arg?: string; label: string };
const GROUPS: { name: string; items: Marco[] }[] = [
  {
    name: "Emphasis",
    items: [
      { code: "b", label: "Bold" },
      { code: "i", label: "Italic" },
      { code: "u", label: "Underline" },
    ],
  },
  {
    name: "Align",
    items: [
      { code: "l", label: "Left" },
      { code: "e", label: "Centre" },
      { code: "r", label: "Right" },
    ],
  },
  {
    name: "Structure",
    items: [
      { code: "h1–h5", label: "Heading 1–5" },
      { code: "p", label: "Normal text" },
    ],
  },
  {
    name: "Type",
    items: [
      { code: "f", arg: "name", label: "Font family" },
      { code: "fs", arg: "n", label: "Set size" },
      { code: "+ −", label: "Bigger / smaller" },
      { code: "fc", arg: "colour", label: "Text colour" },
    ],
  },
  {
    name: "Lists",
    items: [
      { code: "bd", label: "Bulleted" },
      { code: "bn", label: "Numbered" },
      { code: "bc", label: "Checklist" },
    ],
  },
  {
    name: "Insert",
    items: [
      { code: "ii", label: "Image" },
      { code: "iv", label: "Video" },
      { code: "ia", label: "Audio" },
    ],
  },
  {
    name: "Ship",
    items: [
      { code: "eweb", label: "Publish to web" },
      { code: "epdf", label: "Export PDF" },
      { code: "emd", label: "Export Markdown" },
    ],
  },
];

const MONO = "var(--font-jetbrains), ui-monospace, monospace";

/* A keystroke chip — a physical-feeling key. Mono is used *only* here, where the
   content is a literal typed code (a <kbd>), never as decorative voice. */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex items-center rounded-md border border-line bg-paper px-1.5 py-1 text-[0.78rem] font-medium leading-none text-ink shadow-[0_1.5px_0_rgba(33,28,20,0.12)]"
      style={{ fontFamily: MONO }}
    >
      {children}
    </kbd>
  );
}

function MarcoRow({ code, arg, label }: Marco) {
  return (
    <li className="flex items-center gap-3">
      <Key>
        {code}
        {arg && (
          <span className="italic text-ink-soft/70" style={{ fontFamily: MONO }}>
            &nbsp;‹{arg}›
          </span>
        )}
      </Key>
      <span
        aria-hidden
        className="h-px flex-1 border-b border-dotted border-line"
      />
      <span className="whitespace-nowrap text-sm text-ink-soft">{label}</span>
    </li>
  );
}

/**
 * "Go Marco" — the shorthand band. Sits high on the page to make Tiro's promise
 * of speed concrete: select, type a short code, hit return. Left column pitches
 * it; the right column shows the real in-editor HUD applying one; the cheat
 * sheet below lists every marco. All server-rendered; reveals only enhance.
 */
export function ShorthandBand() {
  return (
    <section id="shorthand" className="relative bg-paper py-24 lg:py-32">
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          {/* Pitch */}
          <div data-reveal>
            <span className="inline-flex items-center gap-2 text-ink-soft">
              <GoMarcoIcon className="h-5 w-5 text-yolk-deep" />
              <span
                className="font-display text-lg text-ink"
                style={{ fontVariationSettings: "'opsz' 40, 'SOFT' 30, 'WONK' 1" }}
              >
                Go Marco
              </span>
            </span>

            <h2
              className="mt-4 font-display text-[clamp(2rem,4.5vw,3.25rem)] font-medium leading-[1.02] tracking-[-0.02em] text-ink"
              style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 40, 'WONK' 1" }}
              data-scrub
            >
              Format at the speed of{" "}
              <span className="relative inline-block whitespace-nowrap">
                thought
                <svg
                  aria-hidden
                  viewBox="0 0 200 30"
                  preserveAspectRatio="none"
                  className="pointer-events-none absolute -bottom-1.5 left-0 h-3.5 w-full overflow-visible"
                >
                  <path
                    className="scribble-scrub"
                    pathLength={1}
                    strokeWidth={4}
                    d="M5 19 C 34 9, 62 23, 98 15 S 162 8, 195 20"
                  />
                </svg>
              </span>
              .
            </h2>

            <p className="mt-6 max-w-md text-lg leading-relaxed text-ink-soft">
              Tiro is built to keep pace with you. Turn on{" "}
              <span className="text-ink">Go Marco</span>, select a word, and type
              a short code — <span className="text-ink">h1</span>,{" "}
              <span className="text-ink">b</span>,{" "}
              <span className="text-ink">fc red</span> — then hit return. No
              menus, no mouse, no reaching for the toolbar. Formatting becomes
              muscle memory.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-soft">
              <span>Select a word</span>
              <span aria-hidden className="text-yolk-deep">
                →
              </span>
              <span>type a marco</span>
              <span aria-hidden className="text-yolk-deep">
                →
              </span>
              <span className="inline-flex items-center gap-1.5">
                press <Key>↵</Key>
              </span>
            </div>

            <Link
              href="/login"
              className="group mt-9 inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-sm font-semibold tracking-wide text-paper transition-colors hover:bg-yolk-deep hover:text-ink"
            >
              Write faster
              <span className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </Link>
          </div>

          {/* Demo vignette — the real in-editor flow, frozen mid-keystroke. */}
          <div
            data-reveal
            style={{ ["--reveal-delay" as string]: "0.1s" }}
            aria-hidden
          >
            <figure className="relative rounded-2xl border border-line bg-paper-deep/70 p-6 shadow-[0_30px_70px_-40px_rgba(33,28,20,0.55)] backdrop-blur-sm sm:p-7">
              <figcaption className="mb-6 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-ink-soft">
                <span className="h-px w-6 bg-yolk-deep" />
                Going marco
              </figcaption>

              {/* 1 · the selected line */}
              <p className="text-[0.7rem] text-ink-soft">Select the line</p>
              <p className="mt-1.5 text-lg leading-snug text-ink">
                <span className="rounded-[3px] bg-yolk/30 px-1 py-0.5 [box-decoration-break:clone]">
                  Chapter one
                </span>
              </p>

              {/* 2 · the marco HUD, exactly as it reads in the editor */}
              <p className="mt-6 text-[0.7rem] text-ink-soft">
                Type a marco, hit return
              </p>
              <div className="mt-1.5 inline-flex items-center gap-2 rounded-full border border-line bg-paper px-3 py-2 shadow-[0_8px_20px_-12px_rgba(33,28,20,0.55)]">
                <GoMarcoIcon className="h-4 w-4 text-yolk-deep" />
                <span className="text-xs font-semibold uppercase tracking-wide text-yolk-deep">
                  marco
                </span>
                <span
                  className="rounded bg-paper-deep px-1.5 py-0.5 text-sm text-ink"
                  style={{ fontFamily: MONO }}
                >
                  h1
                </span>
                <Key>↵</Key>
              </div>

              {/* 3 · the result */}
              <div className="mt-6 flex items-center gap-3">
                <span aria-hidden className="text-yolk-deep">
                  ↓
                </span>
                <span className="h-px flex-1 bg-line" />
              </div>
              <p
                className="mt-3 font-display text-3xl font-medium leading-tight tracking-[-0.01em] text-ink"
                style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 40, 'WONK' 1" }}
              >
                Chapter one
              </p>
            </figure>
          </div>
        </div>

        {/* The cheat sheet — every marco, on one warm reference card. */}
        <div
          data-reveal
          className="mt-16 rounded-2xl border border-line bg-paper-deep/50 px-7 py-9 shadow-[0_40px_90px_-60px_rgba(33,28,20,0.6)] sm:px-12 sm:py-12 lg:mt-20"
        >
          <div className="mb-9 flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
            <div className="flex items-center gap-2.5">
              <GoMarcoIcon className="h-5 w-5 text-yolk-deep" />
              <span
                className="font-display text-lg text-ink"
                style={{ fontVariationSettings: "'opsz' 60, 'SOFT' 30, 'WONK' 1" }}
              >
                Every Marco shorthand
              </span>
            </div>
            <span className="text-xs text-ink-soft">
              Case-insensitive · press{" "}
              <kbd
                className="rounded border border-line bg-paper px-1 py-0.5 text-[0.7rem] text-ink"
                style={{ fontFamily: MONO }}
              >
                ↵
              </kbd>{" "}
              to apply
            </span>
          </div>

          <div className="grid gap-x-12 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
            {GROUPS.map((group, i) => (
              <div
                key={group.name}
                data-reveal
                style={{ ["--reveal-delay" as string]: `${0.04 * i}s` }}
              >
                <h3 className="flex items-center gap-2 font-display text-base font-medium text-ink">
                  <span aria-hidden className="h-px w-5 bg-yolk-deep" />
                  {group.name}
                </h3>
                <ul className="mt-3.5 space-y-2.5">
                  {group.items.map((m) => (
                    <MarcoRow key={m.code} {...m} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
