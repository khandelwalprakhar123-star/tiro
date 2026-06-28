"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* One entry in the outline — a live reference to the heading element in the
   contenteditable, plus its level (1–5) and trimmed text for the label. */
type Head = { el: HTMLElement; level: number; text: string };

/* Pixels from the top of the viewport that count as "you're reading here" — a
   heading scrolled above this line is considered passed. Roughly clears the
   sticky formatting toolbar (top-3 + its height). */
const ACTIVE_OFFSET = 140;

/* List (≡) glyph for the closed-state toggle button. */
function ListIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

/**
 * The document outline. Lives entirely in the LEFT gutter (fixed, desktop-only)
 * so it never shifts or overlaps the centred writing column. Closed, it's a
 * round ≡ button floating outside the page; open, it's a card listing every
 * h1–h5 in the document, indented by level. Click a heading to scroll to it;
 * the heading you're currently reading is highlighted as you scroll.
 *
 * Self-contained: it reads headings straight off the live contenteditable via a
 * MutationObserver (re-scanning as you type), so the parent only owns the
 * open/closed flag — no document state is threaded through.
 */
export function OutlinePanel({
  editorRef,
  open,
  onToggle,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  open: boolean;
  onToggle: () => void;
}) {
  const [heads, setHeads] = useState<Head[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const rafRef = useRef<number | null>(null);

  /* Read every heading out of the editor, keeping only the ones with text. */
  const scan = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const nodes = Array.from(
      editor.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5"),
    );
    setHeads(
      nodes
        .map((el) => ({
          el,
          level: Number(el.tagName[1]),
          text: (el.textContent || "").trim(),
        }))
        .filter((h) => h.text.length > 0),
    );
  }, [editorRef]);

  /* While open, re-scan on any edit. Coalesce bursts of mutations into a single
     scan per frame so fast typing doesn't thrash. */
  useEffect(() => {
    if (!open) return;
    const editor = editorRef.current;
    if (!editor) return;
    scan();
    const obs = new MutationObserver(() => {
      if (rafRef.current != null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        scan();
      });
    });
    obs.observe(editor, {
      childList: true,
      subtree: true,
      characterData: true,
    });
    return () => {
      obs.disconnect();
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [open, editorRef, scan]);

  /* While open, track which heading you're reading: the last one whose top has
     scrolled above the active line. */
  useEffect(() => {
    if (!open) return;
    const onScroll = () => {
      let idx = 0;
      heads.forEach((h, i) => {
        if (h.el.getBoundingClientRect().top - ACTIVE_OFFSET <= 0) idx = i;
      });
      setActiveIdx(idx);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [open, heads]);

  /* Scroll a heading into view, offset so the sticky toolbar doesn't cover it. */
  const goTo = useCallback((h: Head) => {
    const top =
      window.scrollY + h.el.getBoundingClientRect().top - (ACTIVE_OFFSET - 30);
    window.scrollTo({ top, behavior: "smooth" });
  }, []);

  /* Closed — just the floating opener in the gutter. */
  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        title="Show outline"
        aria-label="Show document outline"
        className="fixed left-5 top-1/2 z-40 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-paper/90 text-ink-soft shadow-[0_10px_30px_-12px_rgba(33,28,20,0.5)] backdrop-blur transition-colors hover:text-ink lg:flex"
      >
        <ListIcon className="h-5 w-5" />
      </button>
    );
  }

  /* Open — the outline card, fixed in the left gutter. */
  return (
    <div className="fixed left-5 top-24 z-40 hidden w-[15.5rem] flex-col overflow-hidden rounded-2xl border border-line bg-paper/95 shadow-[0_24px_60px_-30px_rgba(33,28,20,0.55)] backdrop-blur lg:flex">
      {/* Header — the collapse toggle. */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        title="Hide outline"
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-paper-deep/40"
      >
        <ListIcon className="h-4 w-4 shrink-0 text-yolk-deep" />
        <span
          className="flex-1 font-display text-[0.95rem] text-ink"
          style={{ fontVariationSettings: "'opsz' 40, 'SOFT' 30, 'WONK' 1" }}
        >
          Outline
        </span>
        <svg
          aria-hidden
          viewBox="0 0 24 24"
          className="h-4 w-4 shrink-0 text-ink-soft"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* chevron-left — collapses the panel back to the gutter button */}
          <path d="M15 6l-6 6 6 6" />
        </svg>
      </button>

      {/* Body — the heading list (or an empty hint). */}
      <div className="max-h-[65vh] overflow-y-auto border-t border-line px-2 py-2">
        {heads.length === 0 ? (
          <p className="px-2 py-3 text-[0.78rem] leading-snug text-ink-soft">
            No headings yet. Format text as Heading 1–5 to build your outline.
          </p>
        ) : (
          <ul>
            {heads.map((h, i) => {
              const active = i === activeIdx;
              return (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => goTo(h)}
                    title={h.text}
                    style={{ paddingLeft: `${0.25 + (h.level - 1) * 0.85}rem` }}
                    className={`flex w-full items-center border-l-2 py-1.5 pr-2 text-left text-[0.82rem] leading-snug transition-colors ${
                      active
                        ? "border-yolk-deep bg-paper-deep/60 font-medium text-ink"
                        : "border-transparent text-ink-soft hover:bg-paper-deep/40 hover:text-ink"
                    }`}
                  >
                    <span className="truncate">{h.text}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
