// Shared card glyphs. FileIcon = a document; FolderIcon = a folder.
// Kept visually distinct so cards read at a glance.

export function FileIcon() {
  return (
    <svg
      width="40"
      height="48"
      viewBox="0 0 40 48"
      fill="none"
      aria-hidden
      className="text-ink-soft/60 transition-colors group-hover:text-yolk-deep"
    >
      <path
        d="M6 3h18l10 10v30a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"
        fill="var(--paper)"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M24 3v10h10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <line x1="11" y1="24" x2="29" y2="24" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="11" y1="30" x2="29" y2="30" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="11" y1="36" x2="23" y2="36" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

// Image insert glyph — a framed landscape: two mountain peaks + a setting sun.
// Stroke-only / currentColor so it reads as part of the monochrome UI.
export function ImageFrameIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      <rect
        x="3"
        y="4"
        width="18"
        height="16"
        rx="2.5"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <circle cx="8" cy="9" r="1.7" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M4 18 L9 12 L12 15 L15 11 L20 18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// List glyph — three rows marked with a roman "I", an "a", and a dot: signals
// the list-type dropdown (numbered / lettered / bulleted).
export function ListIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      <text x="2" y="9" fontSize="6.5" fill="currentColor" fontFamily="serif">I</text>
      <path d="M9 7H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <text x="2" y="14.5" fontSize="6.5" fill="currentColor" fontFamily="serif">a</text>
      <path d="M9 12.5H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="3.6" cy="17.6" r="1.2" fill="currentColor" />
      <path d="M9 18H21" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

// Text-align glyph — the universal stack of horizontal lines.
export function TextAlignIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      <path
        d="M5 7H19 M8 11H16 M5 15H19 M8 19H16"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

// Align glyph — a framed block of lines flanked by left/right arrows, i.e.
// "←[≡]→": signals one-dimensional (horizontal) alignment in the dropdown.
export function AlignIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      {/* left arrow */}
      <path d="M6 12H2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M4 10 L2 12 L4 14" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      {/* right arrow */}
      <path d="M18 12H22" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M20 10 L22 12 L20 14" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
      {/* empty frame — it's an image, so no inner lines */}
      <rect x="7" y="7" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

// Checklist glyph — an empty thick-bordered square with a tick that overshoots
// the top-right corner.
export function ChecklistIcon({ className }: { className?: string }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      <rect x="4" y="6" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="2.2" />
      <path
        d="M7.5 12.5 L10.5 16 L21 4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Simple line trash bin — replaces the 🗑 emoji in the image toolbar.
export function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
      className={className}
    >
      <path d="M4 7h16" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M9 7V5.2A1.2 1.2 0 0 1 10.2 4h3.6A1.2 1.2 0 0 1 15 5.2V7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

export function FolderIcon() {
  return (
    <svg
      width="48"
      height="40"
      viewBox="0 0 48 40"
      fill="none"
      aria-hidden
      className="text-ink-soft/60 transition-colors group-hover:text-yolk-deep"
    >
      {/* back tab + body of a folder — clearly not a page */}
      <path
        d="M4 9a3 3 0 0 1 3-3h11l4 5h19a3 3 0 0 1 3 3v19a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V9z"
        fill="var(--paper)"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}
