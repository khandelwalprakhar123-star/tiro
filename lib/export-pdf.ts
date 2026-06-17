// Export a document to a PDF and open it in a new browser tab for viewing.
//
// Why a hand-written renderer (not html2canvas / a headless browser):
//   • The PDF must OPEN IN A NEW TAB, never download. We generate a real
//     application/pdf Blob and point a tab at its object URL — the browser's
//     built-in PDF viewer takes it from there (the user downloads if they want).
//   • Walking the editor DOM and emitting jsPDF text/image primitives gives
//     SELECTABLE text, small files, and the warm paper/ink look — and sidesteps
//     html2canvas's cross-origin canvas-taint problems with Supabase image URLs.
//   • No serverless headless-Chromium: everything runs in the user's browser.
//
// Media that can't live in a static PDF degrade gracefully: a video shows its
// poster frame (else a "[video]" placeholder), audio shows an "[audio]" chip,
// and a link-preview card shows its thumbnail + title + URL. Nothing throws.
//
// jsPDF is imported dynamically so it only loads when the user actually exports.

// ── Page + palette (A4 portrait, points) ─────────────────────────────────────
const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 60;
const CONTENT_W = PAGE_W - MARGIN * 2;

// The doc's own tokens (app/globals.css): warm paper, dark ink, soft ink, yolk.
const PAPER: [number, number, number] = [250, 244, 232];
const INK: [number, number, number] = [33, 28, 20];
const INK_SOFT: [number, number, number] = [107, 96, 81];
const LINE: [number, number, number] = [224, 212, 188];
const YOLK_DEEP: [number, number, number] = [232, 156, 0];

// Serif (times) stands in for the display face Fraunces; sans (helvetica) for
// the body face Hanken Grotesk — the closest built-in jsPDF fonts.
const SERIF = "times";
const SANS = "helvetica";

type Style = { bold: boolean; italic: boolean; underline: boolean };
type Atom = { text: string; style: Style; spaceBefore: boolean };

// A jsPDF font style string from our flags.
function fontStyle(s: Style): string {
  if (s.bold && s.italic) return "bolditalic";
  if (s.bold) return "bold";
  if (s.italic) return "italic";
  return "normal";
}

type JsPdf = import("jspdf").jsPDF;

// Shared render state threaded through the helpers.
type Ctx = {
  doc: JsPdf;
  y: number; // current baseline-ish top cursor
};

function paintPaper(doc: JsPdf) {
  doc.setFillColor(...PAPER);
  doc.rect(0, 0, PAGE_W, PAGE_H, "F");
}

function newPage(ctx: Ctx) {
  ctx.doc.addPage();
  paintPaper(ctx.doc);
  ctx.y = MARGIN;
}

// Make sure `h` points of vertical space remain; otherwise start a new page.
function ensureSpace(ctx: Ctx, h: number) {
  if (ctx.y + h > PAGE_H - MARGIN) newPage(ctx);
}

// ── Inline runs → atoms ──────────────────────────────────────────────────────
// Walk an element's descendants into styled "atoms" (one per word). spaceBefore
// records whether a space separated this word from the previous one, so a word
// split across styles (e.g. wor<b>d</b>) stays glued, while real spaces allow
// line breaks.
function collectAtoms(el: Node, base: Style, out: Atom[], pending: { space: boolean }) {
  el.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const raw = node.textContent ?? "";
      const collapsed = raw.replace(/\s+/g, " ");
      if (collapsed === "") return;
      if (collapsed === " ") {
        pending.space = true;
        return;
      }
      const leading = collapsed.startsWith(" ");
      const trailing = collapsed.endsWith(" ");
      const words = collapsed.trim().split(" ");
      words.forEach((w, i) => {
        out.push({
          text: w,
          style: { ...base },
          spaceBefore: i === 0 ? pending.space || leading : true,
        });
      });
      pending.space = trailing;
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const e = node as HTMLElement;
    if (e.tagName === "BR") {
      out.push({ text: "\n", style: { ...base }, spaceBefore: false });
      pending.space = false;
      return;
    }
    // Don't descend into atomic media inside a paragraph (shouldn't happen, but
    // be safe) — those are handled as their own blocks.
    if (e.matches?.("figure")) return;
    const st = inlineStyle(e, base);
    collectAtoms(e, st, out, pending);
  });
}

// Fold an inline element's emphasis (tag or inline style) into the active style.
function inlineStyle(e: HTMLElement, base: Style): Style {
  const tag = e.tagName;
  const css = e.style;
  const weight = css.fontWeight;
  const bold =
    base.bold ||
    tag === "B" ||
    tag === "STRONG" ||
    weight === "bold" ||
    weight === "bolder" ||
    (!!weight && Number(weight) >= 600);
  const italic =
    base.italic || tag === "I" || tag === "EM" || css.fontStyle === "italic";
  const underline =
    base.underline || tag === "U" || (css.textDecoration || "").includes("underline");
  return { bold, italic, underline };
}

// ── Line breaking + drawing ──────────────────────────────────────────────────
type Line = { atoms: Atom[]; width: number };

// Greedily break atoms into lines that fit `maxWidth`. A "\n" atom (from <br>)
// forces a break. Words glued by spaceBefore=false never break apart.
function breakLines(
  doc: JsPdf,
  atoms: Atom[],
  family: string,
  size: number,
  maxWidth: number,
): Line[] {
  doc.setFontSize(size);
  const widthOf = (text: string, style: Style) => {
    doc.setFont(family, fontStyle(style));
    return doc.getTextWidth(text);
  };
  const spaceW = (style: Style) => widthOf(" ", style);

  const lines: Line[] = [];
  let cur: Atom[] = [];
  let curW = 0;

  const flush = () => {
    lines.push({ atoms: cur, width: curW });
    cur = [];
    curW = 0;
  };

  for (const atom of atoms) {
    if (atom.text === "\n") {
      flush();
      continue;
    }
    const w = widthOf(atom.text, atom.style);
    const connector = cur.length === 0 ? 0 : atom.spaceBefore ? spaceW(atom.style) : 0;
    if (cur.length > 0 && atom.spaceBefore && curW + connector + w > maxWidth) {
      flush();
      cur.push({ ...atom, spaceBefore: false });
      curW = w;
    } else {
      cur.push(cur.length === 0 ? { ...atom, spaceBefore: false } : atom);
      curW += connector + w;
    }
  }
  if (cur.length > 0) flush();
  return lines;
}

// Draw pre-broken lines, advancing the cursor and paging as needed.
function drawLines(
  ctx: Ctx,
  lines: Line[],
  opts: {
    family: string;
    size: number;
    lineHeight: number;
    leftX: number;
    maxWidth: number;
    color: [number, number, number];
    align: "left" | "center" | "right";
  },
) {
  const { doc } = ctx;
  doc.setFontSize(opts.size);
  doc.setTextColor(...opts.color);
  const ascent = opts.size * 0.82;
  const spaceWFor = (style: Style) => {
    doc.setFont(opts.family, fontStyle(style));
    return doc.getTextWidth(" ");
  };

  for (const line of lines) {
    ensureSpace(ctx, opts.lineHeight);
    const baseline = ctx.y + ascent;
    let x =
      opts.align === "left"
        ? opts.leftX
        : opts.align === "right"
          ? opts.leftX + (opts.maxWidth - line.width)
          : opts.leftX + (opts.maxWidth - line.width) / 2;
    for (const atom of line.atoms) {
      if (atom.spaceBefore) x += spaceWFor(atom.style);
      doc.setFont(opts.family, fontStyle(atom.style));
      const w = doc.getTextWidth(atom.text);
      doc.text(atom.text, x, baseline);
      if (atom.style.underline) {
        doc.setDrawColor(...opts.color);
        doc.setLineWidth(0.6);
        doc.line(x, baseline + 1.5, x + w, baseline + 1.5);
      }
      x += w;
    }
    ctx.y += opts.lineHeight;
  }
}

// ── Block renderers ──────────────────────────────────────────────────────────
const HEADING_SIZE: Record<string, number> = {
  H1: 23,
  H2: 19,
  H3: 16.5,
  H4: 14,
  H5: 12.5,
};

function renderParagraph(ctx: Ctx, el: HTMLElement) {
  const atoms: Atom[] = [];
  collectAtoms(el, { bold: false, italic: false, underline: false }, atoms, {
    space: false,
  });
  const align = readAlign(el);
  if (atoms.length === 0) {
    ctx.y += 11 * 1.55 * 0.5; // empty paragraph → a little breathing room
    return;
  }
  const lines = breakLines(ctx.doc, atoms, SANS, 11, CONTENT_W);
  drawLines(ctx, lines, {
    family: SANS,
    size: 11,
    lineHeight: 11 * 1.55,
    leftX: MARGIN,
    maxWidth: CONTENT_W,
    color: INK,
    align,
  });
  ctx.y += 6;
}

function renderHeading(ctx: Ctx, el: HTMLElement) {
  const size = HEADING_SIZE[el.tagName] ?? 16;
  const atoms: Atom[] = [];
  collectAtoms(el, { bold: true, italic: false, underline: false }, atoms, {
    space: false,
  });
  if (atoms.length === 0) return;
  ctx.y += 8; // margin-top
  const lines = breakLines(ctx.doc, atoms, SERIF, size, CONTENT_W);
  drawLines(ctx, lines, {
    family: SERIF,
    size,
    lineHeight: size * 1.2,
    leftX: MARGIN,
    maxWidth: CONTENT_W,
    color: INK,
    align: readAlign(el),
  });
  ctx.y += 6;
}

function readAlign(el: HTMLElement): "left" | "center" | "right" {
  const a = (el.style.textAlign || el.getAttribute("align") || "").toLowerCase();
  if (a === "center") return "center";
  if (a === "right") return "right";
  return "left";
}

// Lists: bullets, numbers, and checklists. Items hang-indent so wrapped lines
// align under the text, not the marker. Nested lists recurse with more indent.
function renderList(ctx: Ctx, list: HTMLElement, depth: number) {
  const ordered = list.tagName === "OL";
  const checklist = list.hasAttribute("data-checklist");
  const indent = MARGIN + depth * 18;
  const markerGap = 16;
  const textX = indent + markerGap;
  const maxWidth = PAGE_W - MARGIN - textX;
  let n = 0;

  Array.from(list.children).forEach((child) => {
    if (child.tagName !== "LI") return;
    const li = child as HTMLElement;
    n += 1;

    // Inline content of the li (excluding nested lists / the checkbox span).
    const atoms: Atom[] = [];
    const pending = { space: false };
    Array.from(li.childNodes).forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const e = node as HTMLElement;
        if (e.tagName === "UL" || e.tagName === "OL") return;
        if (e.hasAttribute?.("data-check")) return;
      }
      collectAtoms(
        { childNodes: [node] } as unknown as Node,
        { bold: false, italic: false, underline: false },
        atoms,
        pending,
      );
    });

    const lines = breakLines(ctx.doc, atoms, SANS, 11, maxWidth);
    if (lines.length === 0) lines.push({ atoms: [], width: 0 });

    // Draw the marker aligned to the first line.
    ensureSpace(ctx, 11 * 1.5);
    const markerBaseline = ctx.y + 11 * 0.82;
    ctx.doc.setFontSize(11);
    if (checklist) {
      const checked = li.hasAttribute("data-checked");
      drawCheckbox(ctx, indent + 1, ctx.y + 1.5, 9, checked);
    } else if (ordered) {
      ctx.doc.setFont(SANS, "normal");
      ctx.doc.setTextColor(...INK_SOFT);
      ctx.doc.text(`${n}.`, indent, markerBaseline);
    } else {
      ctx.doc.setFont(SANS, "normal");
      ctx.doc.setTextColor(...INK);
      ctx.doc.text("•", indent, markerBaseline);
    }

    drawLines(ctx, lines, {
      family: SANS,
      size: 11,
      lineHeight: 11 * 1.5,
      leftX: textX,
      maxWidth,
      color: INK,
      align: "left",
    });

    // Nested lists inside this item.
    Array.from(li.children).forEach((c) => {
      if (c.tagName === "UL" || c.tagName === "OL") {
        renderList(ctx, c as HTMLElement, depth + 1);
      }
    });
  });
  ctx.y += 4;
}

function drawCheckbox(ctx: Ctx, x: number, y: number, size: number, checked: boolean) {
  const { doc } = ctx;
  doc.setDrawColor(...INK);
  doc.setLineWidth(1);
  doc.roundedRect(x, y, size, size, 1.5, 1.5, "S");
  if (checked) {
    doc.setDrawColor(...YOLK_DEEP);
    doc.setLineWidth(1.4);
    doc.line(x + size * 0.22, y + size * 0.52, x + size * 0.42, y + size * 0.74);
    doc.line(x + size * 0.42, y + size * 0.74, x + size * 0.82, y + size * 0.24);
  }
}

// ── Images + media degradation ───────────────────────────────────────────────
type RasterImage = { dataUrl: string; w: number; h: number };

// Fetch an image URL → blob → object URL → <img> → canvas → JPEG data URL.
// Going through fetched bytes (not <img crossOrigin>) keeps the canvas
// untainted for Supabase's public URLs, mirroring the editor's crop path.
// Applies the editor's non-destructive flips/filters so the PDF matches.
async function rasterize(
  url: string,
  opts?: { flipH?: boolean; flipV?: boolean; filter?: string | null },
): Promise<RasterImage | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    try {
      const img = await loadImage(objUrl);
      const w = img.naturalWidth || 1;
      const h = img.naturalHeight || 1;
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const cx = canvas.getContext("2d");
      if (!cx) return null;
      // Paper backdrop so any transparency reads as paper, not black.
      cx.fillStyle = "rgb(250,244,232)";
      cx.fillRect(0, 0, w, h);
      cx.filter = cssFilter(opts?.filter);
      cx.translate(opts?.flipH ? w : 0, opts?.flipV ? h : 0);
      cx.scale(opts?.flipH ? -1 : 1, opts?.flipV ? -1 : 1);
      cx.drawImage(img, 0, 0);
      return { dataUrl: canvas.toDataURL("image/jpeg", 0.92), w, h };
    } finally {
      URL.revokeObjectURL(objUrl);
    }
  } catch {
    return null;
  }
}

function cssFilter(filter?: string | null): string {
  switch (filter) {
    case "grayscale":
      return "grayscale(1)";
    case "sepia":
      return "sepia(0.7)";
    case "contrast":
      return "contrast(1.4)";
    default:
      return "none";
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Place a rasterized image, honoring the figure's width fraction + alignment,
// fitting within the page. Returns after advancing the cursor (paging if needed).
function placeImage(
  ctx: Ctx,
  raster: RasterImage,
  widthFrac: number,
  align: "left" | "center" | "right",
) {
  let drawW = CONTENT_W * Math.min(1, Math.max(0.1, widthFrac));
  let drawH = (raster.h / raster.w) * drawW;
  const maxH = PAGE_H - MARGIN * 2;
  if (drawH > maxH) {
    drawH = maxH;
    drawW = (raster.w / raster.h) * drawH;
  }
  ensureSpace(ctx, drawH + 12);
  const x =
    align === "left"
      ? MARGIN
      : align === "right"
        ? MARGIN + (CONTENT_W - drawW)
        : MARGIN + (CONTENT_W - drawW) / 2;
  ctx.y += 6;
  ctx.doc.addImage(raster.dataUrl, "JPEG", x, ctx.y, drawW, drawH);
  ctx.y += drawH + 6;
}

function figureWidthFrac(fig: HTMLElement, fallback: number): number {
  const w = fig.style.width;
  if (w && w.endsWith("%")) {
    const v = parseFloat(w);
    if (!isNaN(v)) return v / 100;
  }
  return fallback;
}

async function renderImageFigure(ctx: Ctx, fig: HTMLElement) {
  const img = fig.querySelector("img");
  if (!img) return;
  const src = img.getAttribute("src");
  const align = (fig.getAttribute("data-align") as "left" | "center" | "right") || "center";
  const frac = figureWidthFrac(fig, 0.65);
  let raster: RasterImage | null = null;
  if (src) {
    raster = await rasterize(src, {
      flipH: img.getAttribute("data-flip-h") === "1",
      flipV: img.getAttribute("data-flip-v") === "1",
      filter: img.getAttribute("data-filter"),
    });
  }
  if (raster) placeImage(ctx, raster, frac, align);
  else drawPlaceholder(ctx, "[image]", frac);
  renderCaption(ctx, fig);
}

async function renderVideoFigure(ctx: Ctx, fig: HTMLElement) {
  const video = fig.querySelector("video");
  const poster = video?.getAttribute("poster");
  const align = (fig.getAttribute("data-align") as "left" | "center" | "right") || "center";
  const frac = figureWidthFrac(fig, 0.65);
  let raster: RasterImage | null = null;
  if (poster) raster = await rasterize(poster);
  if (raster) {
    placeImage(ctx, raster, frac, align);
    drawMediaTag(ctx, "▶ Video", frac, align);
  } else {
    drawPlaceholder(ctx, "[video]", frac);
  }
  renderCaption(ctx, fig);
}

function renderAudioFigure(ctx: Ctx, fig: HTMLElement) {
  drawPlaceholder(ctx, "♪  [audio]", 0.8, 36);
  renderCaption(ctx, fig);
}

async function renderLinkCard(ctx: Ctx, fig: HTMLElement) {
  const frac = 0.75;
  const thumb = fig.querySelector<HTMLImageElement>("[data-card-media] img");
  if (thumb?.src) {
    const raster = await rasterize(thumb.src);
    if (raster) placeImage(ctx, raster, frac, "center");
  }
  const title =
    fig.querySelector("[data-card-title]")?.textContent?.trim() || "";
  const site = fig.querySelector("[data-card-site]")?.textContent?.trim() || "";
  const href = fig.getAttribute("data-href") || fig.querySelector("a")?.getAttribute("href") || "";
  const label = [site, title].filter(Boolean).join(" — ") || href || "[link]";
  drawCard(ctx, label, href, frac);
  renderCaption(ctx, fig);
}

// A bordered placeholder box for media that can't appear in a static PDF.
function drawPlaceholder(ctx: Ctx, label: string, widthFrac: number, height = 54) {
  const { doc } = ctx;
  const w = CONTENT_W * widthFrac;
  const x = MARGIN + (CONTENT_W - w) / 2;
  ensureSpace(ctx, height + 12);
  ctx.y += 6;
  doc.setFillColor(241, 231, 211); // paper-deep
  doc.setDrawColor(...LINE);
  doc.setLineWidth(1);
  doc.roundedRect(x, ctx.y, w, height, 6, 6, "FD");
  doc.setFont(SANS, "normal");
  doc.setFontSize(10);
  doc.setTextColor(...INK_SOFT);
  doc.text(label, x + w / 2, ctx.y + height / 2 + 3.5, { align: "center" });
  ctx.y += height + 6;
}

// A small caption-like tag drawn just under a placed media frame.
function drawMediaTag(
  ctx: Ctx,
  label: string,
  widthFrac: number,
  align: "left" | "center" | "right",
) {
  const { doc } = ctx;
  doc.setFont(SANS, "italic");
  doc.setFontSize(9);
  doc.setTextColor(...INK_SOFT);
  const w = CONTENT_W * widthFrac;
  const cx =
    align === "left"
      ? MARGIN + w / 2
      : align === "right"
        ? PAGE_W - MARGIN - w / 2
        : PAGE_W / 2;
  ctx.y += 2;
  doc.text(label, cx, ctx.y + 8, { align: "center" });
  ctx.y += 12;
}

// A link-preview card: a bordered box with the title/site and the URL beneath.
function drawCard(ctx: Ctx, label: string, href: string, widthFrac: number) {
  const { doc } = ctx;
  const w = CONTENT_W * widthFrac;
  const x = MARGIN + (CONTENT_W - w) / 2;
  const pad = 10;
  doc.setFont(SANS, "bold");
  doc.setFontSize(10.5);
  const titleLines = doc.splitTextToSize(label, w - pad * 2) as string[];
  const urlLines = href
    ? (doc.setFont(SANS, "normal"),
      doc.setFontSize(8.5),
      doc.splitTextToSize(href, w - pad * 2) as string[])
    : [];
  const boxH = pad * 2 + titleLines.length * 13 + (urlLines.length ? 4 + urlLines.length * 11 : 0);
  ensureSpace(ctx, boxH + 12);
  ctx.y += 6;
  doc.setFillColor(...PAPER);
  doc.setDrawColor(...LINE);
  doc.setLineWidth(1);
  doc.roundedRect(x, ctx.y, w, boxH, 6, 6, "FD");
  let ty = ctx.y + pad + 9;
  doc.setFont(SANS, "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  titleLines.forEach((l) => {
    doc.text(l, x + pad, ty);
    ty += 13;
  });
  if (urlLines.length) {
    ty += 4;
    doc.setFont(SANS, "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...YOLK_DEEP);
    urlLines.forEach((l) => {
      doc.text(l, x + pad, ty);
      ty += 11;
    });
  }
  ctx.y += boxH + 6;
}

function renderCaption(ctx: Ctx, fig: HTMLElement) {
  const cap = fig.querySelector("figcaption");
  const text = cap?.textContent?.trim();
  if (!text) return;
  const atoms: Atom[] = [];
  collectAtoms(cap as HTMLElement, { bold: false, italic: true, underline: false }, atoms, {
    space: false,
  });
  const lines = breakLines(ctx.doc, atoms, SANS, 9, CONTENT_W);
  drawLines(ctx, lines, {
    family: SANS,
    size: 9,
    lineHeight: 9 * 1.4,
    leftX: MARGIN,
    maxWidth: CONTENT_W,
    color: INK_SOFT,
    align: "center",
  });
  ctx.y += 6;
}

// ── Block dispatch ───────────────────────────────────────────────────────────
async function renderBlock(ctx: Ctx, el: HTMLElement) {
  const tag = el.tagName;
  if (tag === "FIGURE") {
    if (el.hasAttribute("data-img")) return renderImageFigure(ctx, el);
    if (el.hasAttribute("data-video")) return renderVideoFigure(ctx, el);
    if (el.hasAttribute("data-audio")) return renderAudioFigure(ctx, el);
    if (el.hasAttribute("data-link-card")) return renderLinkCard(ctx, el);
    return;
  }
  if (HEADING_SIZE[tag]) return renderHeading(ctx, el);
  if (tag === "UL" || tag === "OL") return renderList(ctx, el, 0);
  if (tag === "HR") {
    ensureSpace(ctx, 16);
    ctx.y += 8;
    ctx.doc.setDrawColor(...LINE);
    ctx.doc.setLineWidth(1);
    ctx.doc.line(MARGIN, ctx.y, PAGE_W - MARGIN, ctx.y);
    ctx.y += 8;
    return;
  }
  // Paragraphs, divs, blockquotes, and any stray block → paragraph flow. A block
  // whose children are themselves blocks gets recursed instead of flattened.
  if (tag === "DIV" && Array.from(el.children).some((c) => isBlock(c as HTMLElement))) {
    await renderChildren(ctx, el);
    return;
  }
  renderParagraph(ctx, el);
}

function isBlock(el: HTMLElement): boolean {
  return /^(P|DIV|H[1-5]|UL|OL|FIGURE|BLOCKQUOTE|HR|PRE)$/.test(el.tagName);
}

async function renderChildren(ctx: Ctx, root: HTMLElement) {
  for (const node of Array.from(root.childNodes)) {
    if (node.nodeType === Node.ELEMENT_NODE) {
      await renderBlock(ctx, node as HTMLElement);
    } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      // A bare text node at the top level — wrap it as a paragraph.
      const p = document.createElement("p");
      p.textContent = node.textContent;
      renderParagraph(ctx, p);
    }
  }
}

// ── Title block ──────────────────────────────────────────────────────────────
function renderTitle(ctx: Ctx, title: string) {
  const text = title.trim() || "Untitled";
  const atoms: Atom[] = text
    .split(/\s+/)
    .map((w, i) => ({ text: w, style: { bold: true, italic: false, underline: false }, spaceBefore: i > 0 }));
  const lines = breakLines(ctx.doc, atoms, SERIF, 30, CONTENT_W);
  drawLines(ctx, lines, {
    family: SERIF,
    size: 30,
    lineHeight: 30 * 1.15,
    leftX: MARGIN,
    maxWidth: CONTENT_W,
    color: INK,
    align: "left",
  });
  // A short yolk rule under the title — the document's single accent.
  ctx.y += 6;
  ctx.doc.setDrawColor(...YOLK_DEEP);
  ctx.doc.setLineWidth(2.5);
  ctx.doc.line(MARGIN, ctx.y, MARGIN + 54, ctx.y);
  ctx.y += 18;
}

// ── Build ────────────────────────────────────────────────────────────────────
// Render the editor's document into a jsPDF instance. Exposed on its own so it
// can be reused (download / publish later) and tested in isolation. Never throws
// on media — broken images/posters fall back to placeholders.
export async function buildDocumentPdf(
  title: string,
  editor: HTMLElement,
): Promise<JsPdf> {
  // Clone the live editor and strip runtime-only chrome (drag handles, selection
  // rings, and any still-loading media placeholders) — exactly what the save
  // pipeline persists, so the PDF matches the saved document.
  const clone = editor.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[data-drag-handle]").forEach((n) => n.remove());
  clone.querySelectorAll(".is-selected").forEach((n) => n.classList.remove("is-selected"));
  clone
    .querySelectorAll(
      'figure[data-video][data-status], figure[data-audio][data-status], figure[data-link-card][data-status="loading"]',
    )
    .forEach((n) => n.remove());

  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  const ctx: Ctx = { doc, y: MARGIN };
  paintPaper(doc);

  renderTitle(ctx, title);
  await renderChildren(ctx, clone);
  return doc;
}

// ── Public entry point ───────────────────────────────────────────────────────
// Generates the PDF and points `tab` (a window opened synchronously on click,
// to dodge popup blockers) at the resulting object URL. If `tab` is null the
// caller should surface an "allow pop-ups" message. Never throws on media.
export async function exportDocumentToPdf(opts: {
  title: string;
  editor: HTMLElement;
  tab: Window | null;
}): Promise<void> {
  const { title, editor, tab } = opts;
  const doc = await buildDocumentPdf(title, editor);

  // A real application/pdf object URL → the new tab's address bar → the browser's
  // built-in PDF viewer. No download is ever triggered.
  const url = doc.output("bloburl") as unknown as string;
  if (tab) tab.location.href = url;
  else window.open(url, "_blank", "noopener");
}
