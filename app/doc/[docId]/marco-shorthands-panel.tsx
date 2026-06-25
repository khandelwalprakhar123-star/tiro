"use client";

import { GoMarcoIcon } from "@/components/icons";
import { MARCO_GROUPS, type Marco } from "@/lib/marcos";

const MONO = "var(--font-jetbrains), ui-monospace, monospace";

/* A keystroke chip — a literal typed code, so mono is used here (and only here). */
function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-flex shrink-0 items-center rounded-[5px] border border-line bg-paper px-1.5 py-0.5 text-[0.72rem] font-medium leading-none text-ink shadow-[0_1.5px_0_rgba(33,28,20,0.1)]"
      style={{ fontFamily: MONO }}
    >
      {children}
    </kbd>
  );
}

function MarcoRow({ code, arg, label }: Marco) {
  return (
    <li className="flex items-center gap-2.5">
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
      <span className="whitespace-nowrap text-[0.8rem] text-ink-soft">
        {label}
      </span>
    </li>
  );
}

/**
 * The in-editor "Marco Shorthands" reference panel. Appears in the right gutter
 * while Go Marco is active (desktop only — it overlays the writing column's
 * empty right side). Collapsed by default: a header bar with a chevron. Clicking
 * the header (the dropdown icon) expands it to the full cheat sheet, and clicking
 * again collapses it. Exiting marco mode unmounts it entirely (handled by the
 * caller). The list mirrors lib/marcos.ts so it never drifts from the editor.
 *
 * `pointer-events-none` on the full-height rail lets clicks pass through to the
 * text underneath; only the card itself is interactive.
 */
export function MarcoShorthandsPanel({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="pointer-events-none absolute inset-y-0 right-0 z-30 hidden lg:block">
      <div className="pointer-events-auto sticky top-24 w-[16rem] overflow-hidden rounded-2xl border border-line bg-paper/95 shadow-[0_24px_60px_-30px_rgba(33,28,20,0.55)] backdrop-blur">
        {/* Header — the dropdown toggle. */}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          onMouseDown={(e) => e.preventDefault()}
          className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-paper-deep/40"
        >
          <GoMarcoIcon className="h-4 w-4 shrink-0 text-yolk-deep" />
          <span
            className="flex-1 font-display text-[0.95rem] text-ink"
            style={{ fontVariationSettings: "'opsz' 40, 'SOFT' 30, 'WONK' 1" }}
          >
            Marco Shorthands
          </span>
          <svg
            aria-hidden
            viewBox="0 0 24 24"
            className={`h-4 w-4 shrink-0 text-ink-soft transition-transform duration-200 ease-out motion-reduce:transition-none ${
              open ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>

        {/* Body — animates open/closed via the grid 0fr→1fr height trick. */}
        <div
          className="grid transition-[grid-template-rows] duration-200 ease-out motion-reduce:transition-none"
          style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            <div className="max-h-[60vh] overflow-y-auto border-t border-line px-4 pb-4 pt-3.5">
              <p className="mb-3 text-[0.72rem] leading-snug text-ink-soft">
                Select text, type a code, press{" "}
                <kbd
                  className="rounded border border-line bg-paper px-1 py-px text-[0.68rem] text-ink"
                  style={{ fontFamily: MONO }}
                >
                  ↵
                </kbd>
                .
              </p>
              <div className="space-y-4">
                {MARCO_GROUPS.map((group) => (
                  <div key={group.name}>
                    <h3 className="flex items-center gap-2 text-[0.72rem] font-semibold uppercase tracking-[0.14em] text-ink-soft">
                      <span aria-hidden className="h-px w-3.5 bg-yolk-deep" />
                      {group.name}
                    </h3>
                    <ul className="mt-2 space-y-1.5">
                      {group.items.map((m) => (
                        <MarcoRow key={m.code} {...m} />
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
