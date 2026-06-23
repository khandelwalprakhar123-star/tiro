# Product

## Register

product

> Tiro the application is a product surface (the editor, workspace, profile, trash).
> Its **marketing surfaces — the landing page, any future about/pricing pages — are brand**,
> and should be designed in the brand register. Override per task accordingly.

## Users

Writers, students, and creators who think in more than just words. They draft prose but also
want a recorded voice memo, a reference image, a video, or a link to live *inside* the same
document — not scattered across a doc tool, a notes app, and a drive folder. Context: focused,
desk-first composition sessions; they care about how the finished piece reads and shares.

## Product Purpose

Tiro is a web-based multimodal document editor — "Google Docs with first-class media embeds."
One document holds text, images, audio (with a real waveform player), video, and rich link
unfurls. Documents live in many folders at once as a single source of truth, and ship out as a
PDF, a Markdown file, or a public web page at `<slug>.tiro.works`. Success: a writer composes a
rich, media-laden piece in one place and publishes or exports it without ever leaving Tiro.

Named after Marcus Tullius Tiro, Cicero's scribe and the inventor of shorthand — the original
act of turning fleeting speech into durable, shareable writing.

## Brand Personality

Warm, literate, and crafted — paper-and-ink rather than chrome-and-glass. Confident without
shouting; the voice of a good notebook and a good editor at once. Three words:
**warm, editorial, deliberate.** The interface should feel hand-made and tactile (paper grain,
an inked egg-yolk accent, a characterful display serif), and quietly delight rather than dazzle.

## Anti-references

- Generic white-background SaaS landing pages (the Linear/Notion-clone look): cool grays,
  neutral geometric sans, gradient-mesh blobs, glassmorphic cards.
- The cream/sand "editorial restraint" monoculture used without conviction — Tiro's warmth is
  earned through a committed palette and real product proof, not a beige wash.
- Feature-checkbox grids of identical icon cards.
- Anything that reads as cold, corporate, or template-built. If a visitor can't tell a human
  cared, it's wrong.

## Design Principles

- **Show the document, don't describe it.** Tiro's superpower is many media in one doc; prove it
  with faithful, working product mockups rather than adjectives.
- **Say what it is: a multimodal text editor.** Tiro does *not* transcribe handwriting, speech, or
  scribbles into text — there is no capture-to-text conversion. It lets you compose prose
  alongside images, audio (with a real waveform), video, and link unfurls on one page, then
  publish or export it. Copy and mockups must represent that honestly; never imply a feature the
  product doesn't have. (The old "the scribble becomes text" framing was misleading and has been
  removed from the landing page.)
- **Paper and ink, committed.** A warm-paper surface, true ink, and one inked egg-yolk accent.
  Warmth comes from the whole palette and typography, never from a timid near-white. Hand-drawn
  ink underlines, swashes, and the marginal scroll-line are *decorative brand voice* — emphasis on
  paper — and never a claim that Tiro converts anything into text.
- **Tactile, not flashy.** Grain, inked swashes, characterful Fraunces. Craft over spectacle.
- **Earn every section.** No scaffolding-by-reflex (no eyebrow on every heading, no numbered
  markers unless the thing is genuinely a sequence).

## Accessibility & Inclusion

- WCAG 2.1 AA: body text ≥ 4.5:1, large text ≥ 3:1. Verify ink/ink-soft on paper and yolk-on-ink
  in the drenched band specifically.
- Every animation (scribble draw, scroll reveals, audio fill) has a
  `prefers-reduced-motion: reduce` alternative that lands on the finished state immediately.
- Content is visible by default and never gated behind a JS/animation class (works without JS,
  in headless renderers, and on hidden tabs).
- Semantic landmarks, real headings, keyboard-reachable controls, focus-visible states, and
  descriptive alt text on any imagery.
