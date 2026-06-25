"use client";

/**
 * ThemeToggle — switches between the two named themes:
 *   Yolk  = light (default)      Innocence = dark (baby blue)
 *
 * The control is a minimal rounded rectangle that *shows both themes at once*:
 * a light half with a yolk Sun on the left, a "\" seam, then a dark half with a
 * baby-blue Moon on the right. Whichever theme is active shows at full strength; the
 * other dims — and that highlight is driven entirely by `html[data-theme]` in
 * CSS (see .tt-sun / .tt-moon in globals.css), NOT by React state. That keeps
 * the server and client markup identical, so there's no hydration flash on the
 * button. We read the live theme from the DOM only at click-time and flip it,
 * persisting the choice to the same `tiro-theme` key the no-flash script reads.
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  function toggle() {
    const root = document.documentElement;
    const next =
      root.getAttribute("data-theme") === "innocence" ? "yolk" : "innocence";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("tiro-theme", next);
    } catch {
      /* localStorage may be unavailable (private mode); the switch still works. */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle color theme — Yolk (light) or Innocence (dark)"
      title="Toggle theme — Yolk / Innocence"
      className={`group inline-flex items-center justify-center rounded-[11px] outline-none transition-transform duration-200 hover:scale-[1.04] focus-visible:ring-2 focus-visible:ring-clay focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)] ${className}`}
    >
      <svg
        width="58"
        height="29"
        viewBox="0 0 64 32"
        aria-hidden="true"
        className="block"
      >
        <defs>
          <clipPath id="tt-rect">
            <rect x="0.6" y="0.6" width="62.8" height="30.8" rx="9.5" />
          </clipPath>
        </defs>

        <g clipPath="url(#tt-rect)">
          {/* Left half — the light (Yolk) world */}
          <polygon points="0,0 30,0 42,32 0,32" fill="#FBF7F1" />
          {/* Right half — the dark (Innocence) world */}
          <polygon points="30,0 64,0 64,32 42,32" fill="#15171C" />
          {/* The "\" seam between the two worlds */}
          <line
            x1="30"
            y1="0"
            x2="42"
            y2="32"
            stroke="#9A958F"
            strokeOpacity="0.55"
            strokeWidth="1.1"
          />

          {/* Sun — yolk, on the light half */}
          <g className="tt-sun" stroke="#FFB300" strokeWidth="1.3" strokeLinecap="round">
            <circle cx="16" cy="16" r="3.4" fill="#FFB300" stroke="none" />
            <line x1="16" y1="10.4" x2="16" y2="8.2" />
            <line x1="16" y1="21.6" x2="16" y2="23.8" />
            <line x1="21.6" y1="16" x2="23.8" y2="16" />
            <line x1="10.4" y1="16" x2="8.2" y2="16" />
            <line x1="19.95" y1="12.05" x2="21.5" y2="10.5" />
            <line x1="12.05" y1="12.05" x2="10.5" y2="10.5" />
            <line x1="19.95" y1="19.95" x2="21.5" y2="21.5" />
            <line x1="12.05" y1="19.95" x2="10.5" y2="21.5" />
          </g>

          {/* Moon — baby-blue crescent, on the dark half (carved by a bg-coloured circle) */}
          <g className="tt-moon">
            <circle cx="47.4" cy="16" r="4.7" fill="#A6D2F2" />
            <circle cx="50.1" cy="13.7" r="4.2" fill="#15171C" />
          </g>
        </g>

        {/* Hairline frame so the control reads as one rounded rectangle */}
        <rect
          x="0.6"
          y="0.6"
          width="62.8"
          height="30.8"
          rx="9.5"
          fill="none"
          stroke="var(--line)"
          strokeWidth="1.2"
        />
      </svg>
    </button>
  );
}
