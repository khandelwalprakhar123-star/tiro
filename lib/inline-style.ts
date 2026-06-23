// Inline font styling (family + size) for the contenteditable editor.
//
// Why this exists: the browser's execCommand can't do what we need on its own.
// execCommand("fontSize") only accepts the legacy 1–7 scale (not "18px"), and
// execCommand("fontName") mangles custom font-family values (e.g. our
// `var(--font-lora), serif`). BUT execCommand is excellent at the genuinely hard
// part — wrapping *exactly* the selected text across all its node and block
// boundaries. So we use it as a MARKER: run fontSize("7") to wrap the selection
// in <font size="7"> tags, then rewrite each marker into a <span> carrying the
// real style we want. One primitive (styleSelection) powers both family + size.

// ── Size scale ────────────────────────────────────────────────────────────
// The toolbar shows an abstract size number (Word-style). Body text defaults to
// 11, which must keep rendering at the current .doc-content size (1.125rem =
// 18px) so existing documents don't visually jump. Everything scales off that.
export const DEFAULT_SIZE = 11;
export const MIN_SIZE = 6;
export const MAX_SIZE = 96;
const BASE_PX = 18; // what label 11 renders at today

const clampSize = (n: number) =>
  Math.min(MAX_SIZE, Math.max(MIN_SIZE, Math.round(n)));

export const sizeToPx = (n: number) =>
  +((clampSize(n) * BASE_PX) / DEFAULT_SIZE).toFixed(2);
export const pxToSize = (px: number) =>
  clampSize((px * DEFAULT_SIZE) / BASE_PX);

// ── Font catalogue ──────────────────────────────────────────────────────────
// `value` is the CSS font-family applied inline. The var(--font-*) entries are
// loaded via next/font in app/layout.tsx; Georgia is a universal system serif
// (no load needed); "" means "remove the inline font" → inherit the doc default.
export type FontOption = { id: string; label: string; value: string };

export const FONTS: FontOption[] = [
  { id: "default", label: "Default", value: "" },
  { id: "fraunces", label: "Fraunces", value: "var(--font-display), serif" },
  { id: "hanken", label: "Hanken Grotesk", value: "var(--font-body), sans-serif" },
  { id: "lora", label: "Lora", value: "var(--font-lora), serif" },
  { id: "source-serif", label: "Source Serif", value: "var(--font-source-serif), serif" },
  { id: "inter", label: "Inter", value: "var(--font-inter), sans-serif" },
  { id: "jetbrains", label: "JetBrains Mono", value: "var(--font-jetbrains), monospace" },
  // System fonts — already installed on the reader's machine, so no load needed.
  // Each stack falls back to a generic so it degrades gracefully where absent
  // (e.g. Calibri → Segoe UI → sans-serif on machines without Calibri).
  { id: "georgia", label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { id: "times", label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { id: "arial", label: "Arial", value: "Arial, 'Helvetica Neue', Helvetica, sans-serif" },
  { id: "calibri", label: "Calibri", value: "Calibri, 'Segoe UI', sans-serif" },
  { id: "helvetica", label: "Helvetica", value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
];

const norm = (s: string) => s.replace(/["']/g, "").replace(/\s+/g, "").toLowerCase();

// ── The primitive ────────────────────────────────────────────────────────────
// Wrap the current selection (via the fontSize marker trick) and let `mutate`
// stamp the desired style onto each resulting <span>. Returns false (no-op) when
// there's nothing usable selected — font changes apply to selected text only.
function styleSelection(
  editor: HTMLElement,
  mutate: (span: HTMLSpanElement) => void,
): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  if (!editor.contains(sel.anchorNode) || !editor.contains(sel.focusNode)) {
    return false;
  }

  // styleWithCSS=false makes fontSize emit <font size="7"> (an element we can
  // find), rather than a CSS keyword span. That tag is purely our marker.
  document.execCommand("styleWithCSS", false, "false");
  document.execCommand("fontSize", false, "7");

  const marks = Array.from(editor.querySelectorAll('font[size="7"]'));
  if (marks.length === 0) return false;

  const spans: HTMLSpanElement[] = [];
  for (const f of marks) {
    const span = document.createElement("span");
    while (f.firstChild) span.appendChild(f.firstChild);
    mutate(span);
    f.replaceWith(span);
    spans.push(span);
  }

  // Re-select the rewritten range so the user can keep nudging size / switching
  // font without having to re-highlight each time.
  const range = document.createRange();
  range.setStartBefore(spans[0]);
  range.setEndAfter(spans[spans.length - 1]);
  sel.removeAllRanges();
  sel.addRange(range);
  return true;
}

// Strip `prop` from descendant spans so a freshly applied value wins cleanly and
// we don't stack a new <span> on every repeated nudge. Unwrap any span left with
// no style at all (keeps the saved HTML from growing junk wrappers).
function clearDescendant(span: HTMLSpanElement, prop: string) {
  span.querySelectorAll<HTMLElement>("span").forEach((inner) => {
    inner.style.removeProperty(prop);
    if (!inner.getAttribute("style")) {
      while (inner.firstChild) {
        inner.parentNode!.insertBefore(inner.firstChild, inner);
      }
      inner.remove();
    }
  });
}

export function applyFontFamily(editor: HTMLElement, value: string): boolean {
  return styleSelection(editor, (span) => {
    clearDescendant(span, "font-family");
    if (value) span.style.fontFamily = value;
  });
}

// Begin a "type-ahead" font run at a COLLAPSED caret — the counterpart to
// applyFontFamily for when nothing is selected. We insert an empty <span> in the
// chosen font, anchored by a zero-width space (an empty inline element gives the
// caret nowhere to live), and drop the caret inside it. The browser then types
// the next characters straight into that span, so they inherit the font — and so
// do new lines split off from it. The ZWSP is stripped from the saved HTML.
// Returns false when there's a real selection (caller should style that) or when
// "Default" is chosen but the caret isn't inside a font run (already default).
export function startFontRun(editor: HTMLElement, value: string): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;
  if (!editor.contains(sel.anchorNode)) return false;
  if (!value && currentFontId(editor) === "default") return false;

  const span = document.createElement("span");
  // A real font uses its stack; "Default" gets the editor's own base family, so
  // the run still overrides any surrounding font span the caret sits inside.
  span.style.fontFamily = value || getComputedStyle(editor).fontFamily;
  const anchor = document.createTextNode("\u200B"); // zero-width space
  span.appendChild(anchor);

  sel.getRangeAt(0).insertNode(span);

  // Caret just past the zero-width space, inside the span → typing flows in.
  const caret = document.createRange();
  caret.setStart(anchor, 1);
  caret.collapse(true);
  sel.removeAllRanges();
  sel.addRange(caret);
  return true;
}

export function applyFontSize(editor: HTMLElement, sizeLabel: number): boolean {
  const px = sizeToPx(sizeLabel);
  return styleSelection(editor, (span) => {
    clearDescendant(span, "font-size");
    span.style.fontSize = `${px}px`;
  });
}

// ── Font colour ───────────────────────────────────────────────────────────
// Same model as font family: style the selection, or (empty value) clear it.
// `color` is any CSS colour string (we feed it hex like "#ff0000"); "" removes
// the inline colour so the text falls back to the document's default ink.
export function applyFontColor(editor: HTMLElement, color: string): boolean {
  return styleSelection(editor, (span) => {
    clearDescendant(span, "color");
    if (color) span.style.color = color;
  });
}

// Type-ahead colour run at a COLLAPSED caret — counterpart to startFontRun.
// Insert an empty <span style="color:…"> anchored by a zero-width space and drop
// the caret inside, so the next characters (and lines split off it) inherit the
// colour. The ZWSP is stripped from the saved HTML. Returns false when there's a
// real selection (caller should style that instead).
export function startColorRun(editor: HTMLElement, color: string): boolean {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || !sel.isCollapsed) return false;
  if (!editor.contains(sel.anchorNode)) return false;
  if (!color && currentColor(editor) === "") return false;

  const span = document.createElement("span");
  span.style.color = color || getComputedStyle(editor).color;
  const anchor = document.createTextNode("​"); // zero-width space
  span.appendChild(anchor);

  sel.getRangeAt(0).insertNode(span);

  const caret = document.createRange();
  caret.setStart(anchor, 1);
  caret.collapse(true);
  sel.removeAllRanges();
  sel.addRange(caret);
  return true;
}

// Nearest inline colour from the selection up to the editor, normalised to a
// lowercase #rrggbb hex; "" when no inline colour is set (i.e. default ink).
export function currentColor(editor: HTMLElement): string {
  let node: HTMLElement | null = selectionElement(editor);
  while (node && node !== editor) {
    const c = node.style?.color;
    if (c) return rgbToHex(c);
    node = node.parentElement;
  }
  return "";
}

// "rgb(255, 0, 0)" / "#f00" / "#ff0000" → "#ff0000". Leaves unknown formats as-is.
function rgbToHex(color: string): string {
  const m = color.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const [r, g, b] = m[1].split(",").map((n) => parseInt(n, 10));
    return (
      "#" +
      [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")
    ).toLowerCase();
  }
  if (/^#[0-9a-f]{3}$/i.test(color)) {
    const [, r, g, b] = color;
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return color.toLowerCase();
}

// ── Reading the current selection's font (for toolbar reflection) ─────────────
// The representative element AT the start of the selection. Crucially this must
// descend into the boundary's child: after we apply a style we re-select with
// range.setStartBefore(span), so startContainer is the *container* (whose own
// font is the doc default) and startOffset points at the freshly-styled span.
// Reading the container instead of that child is the bug that froze the size
// readout at 11 and reset the font label to Default after every apply.
function selectionElement(editor: HTMLElement): HTMLElement | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  let node: Node | null = range.startContainer;
  if (node.nodeType === 1) {
    const el = node as HTMLElement;
    node =
      el.childNodes[range.startOffset] ??
      el.childNodes[range.startOffset - 1] ??
      el;
  }
  const el =
    node && (node.nodeType === 1 ? (node as HTMLElement) : node.parentElement);
  return el && editor.contains(el) ? el : null;
}

// Nearest inline font-family from the selection up to the editor; mapped back to
// a catalogue id ("default" if none, "custom" if something off-list).
export function currentFontId(editor: HTMLElement): string {
  let node: HTMLElement | null = selectionElement(editor);
  let family = "";
  while (node && node !== editor) {
    const fam = node.style?.fontFamily;
    if (fam) {
      family = fam;
      break;
    }
    node = node.parentElement;
  }
  if (!family) return "default";
  const hit = FONTS.find((f) => f.value && norm(f.value) === norm(family));
  return hit ? hit.id : "custom";
}

// The displayed size number = computed pixel size at the selection, mapped to our
// label scale. Falls back to the default when the caret isn't in the editor.
export function currentSize(editor: HTMLElement): number {
  const el = selectionElement(editor);
  if (!el) return DEFAULT_SIZE;
  const px = parseFloat(getComputedStyle(el).fontSize);
  return px ? pxToSize(px) : DEFAULT_SIZE;
}
