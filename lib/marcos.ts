/* ── Marco shorthands — single source of truth ───────────────────────────────
   Every shipped marco, grouped for display. `arg` renders as a ‹placeholder›
   inside the key chip (e.g. `f ‹name›`). Consumed by BOTH the landing-page
   cheat sheet (components/landing/shorthand-band.tsx) and the in-editor
   "Marco Shorthands" panel (app/doc/[docId]/marco-shorthands-panel.tsx).

   Keep this in sync with runMarco() in document-editor.tsx and prd.md §15.
   This is the one place the marco list lives — edit here, both surfaces update. */

export type Marco = { code: string; arg?: string; label: string };

export type MarcoGroup = { name: string; items: Marco[] };

export const MARCO_GROUPS: MarcoGroup[] = [
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
