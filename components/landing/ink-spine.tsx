/**
 * The marginal pen line. A single ink stroke fixed to the left gutter that
 * draws itself in proportion to how far down the page you've scrolled — the
 * page read as one continuous line. Purely decorative (`aria-hidden`); all the
 * motion lives in CSS, driven by the `--page-progress` variable the
 * <RevealManager> writes each frame. Hidden until JS arms it and on narrow
 * screens (see `.ink-spine` in globals.css), so it can only ever enhance.
 */

// A gentle vertical meander. `preserveAspectRatio="none"` stretches it to the
// full viewport height; `pathLength={1}` normalises the dash maths so one
// offset value (0→1) draws the whole thing regardless of its real length.
const SPINE_D =
  "M18 2 C 6 92, 30 182, 18 282 S 4 462, 18 562 S 32 742, 18 842 S 8 962, 18 998";

export function InkSpine() {
  return (
    <div className="ink-spine" aria-hidden>
      <svg viewBox="0 0 36 1000" preserveAspectRatio="none">
        <path className="ink-spine__track" d={SPINE_D} pathLength={1} />
        <path className="ink-spine__line" d={SPINE_D} pathLength={1} />
      </svg>
    </div>
  );
}
