// Export a document to a Markdown (.md) file and download it.
//
// Mirrors lib/export-pdf.ts in spirit: we clone the live editor, strip the
// runtime-only chrome (drag handles, selection rings, still-loading media) so
// the output matches what's persisted, then walk the DOM tree. Where the PDF
// path emits jsPDF drawing primitives, this path emits Markdown text — so there
// is no layout/pagination math, just string building.
//
// Markdown can't host real media, so media degrades gracefully: an image
// becomes ![caption](src), a video/audio becomes a link (or an italic
// placeholder), and a link-preview card becomes a normal [title](url) link.
// Nothing throws.

// ── Inline runs → Markdown ───────────────────────────────────────────────────
// Emphasis markers can't wrap leading/trailing spaces (e.g. "** bold **" is
// invalid), so we lift any surrounding whitespace outside the markers.
function wrap(marker: string, inner: string): string {
  const m = inner.match(/^(\s*)([\s\S]*?)(\s*)$/);
  if (!m || m[2] === "") return inner; // nothing but whitespace → leave as-is
  return `${m[1]}${marker}${m[2]}${marker}${m[3]}`;
}

// Serialize all of an element's children into inline Markdown.
function inlineChildren(el: Node): string {
  let out = "";
  el.childNodes.forEach((node) => {
    out += inlineNode(node);
  });
  return out;
}

// Serialize a single node (text or inline element) into Markdown.
function inlineNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    // Collapse runs of whitespace to single spaces (DOM/HTML semantics).
    return (node.textContent ?? "").replace(/\s+/g, " ");
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";
  const e = node as HTMLElement;
  switch (e.tagName) {
    case "BR":
      return "  \n"; // a hard line break inside a paragraph
    case "STRONG":
    case "B":
      return wrap("**", inlineChildren(e));
    case "EM":
    case "I":
      return wrap("*", inlineChildren(e));
    case "CODE":
      return wrap("`", inlineChildren(e));
    case "A": {
      const href = e.getAttribute("href") || "";
      const text = inlineChildren(e);
      return href ? `[${text}](${href})` : text;
    }
    // Underline has no native Markdown; emit the text plainly. Any other inline
    // wrapper (span, etc.) just contributes its children.
    default:
      return inlineChildren(e);
  }
}

// ── Block renderers ──────────────────────────────────────────────────────────
const HEADING_LEVEL: Record<string, number> = {
  H1: 1,
  H2: 2,
  H3: 3,
  H4: 4,
  H5: 5,
  H6: 6,
};

function isBlock(el: HTMLElement): boolean {
  return /^(P|DIV|H[1-6]|UL|OL|FIGURE|BLOCKQUOTE|HR|PRE)$/.test(el.tagName);
}

// Lists: bullets, numbers, and checklists. Nested lists recurse with two extra
// spaces of indent per level (the Markdown convention for sub-lists).
function renderList(list: HTMLElement, depth: number): string {
  const ordered = list.tagName === "OL";
  const checklist = list.hasAttribute("data-checklist");
  const indent = "  ".repeat(depth);
  const lines: string[] = [];
  let n = 0;

  Array.from(list.children).forEach((child) => {
    if (child.tagName !== "LI") return;
    const li = child as HTMLElement;
    n += 1;

    // Inline content of the li, excluding nested lists and the checkbox span;
    // nested lists are rendered separately, indented one level deeper.
    let text = "";
    const nested: HTMLElement[] = [];
    Array.from(li.childNodes).forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const e = node as HTMLElement;
        if (e.tagName === "UL" || e.tagName === "OL") {
          nested.push(e);
          return;
        }
        if (e.hasAttribute("data-check")) return; // the rendered checkbox glyph
      }
      text += inlineNode(node);
    });

    const marker = checklist
      ? li.hasAttribute("data-checked")
        ? "- [x] "
        : "- [ ] "
      : ordered
        ? `${n}. `
        : "- ";
    lines.push(indent + marker + text.trim());
    nested.forEach((sub) => lines.push(renderList(sub, depth + 1)));
  });

  return lines.join("\n");
}

function caption(fig: HTMLElement): string {
  return fig.querySelector("figcaption")?.textContent?.trim() || "";
}

// A figure → image / video / audio / link-card Markdown. Media that can't live
// in Markdown degrades to a link or an italic placeholder.
function renderFigure(fig: HTMLElement): string {
  if (fig.hasAttribute("data-img")) {
    const src = fig.querySelector("img")?.getAttribute("src") || "";
    return src ? `![${caption(fig)}](${src})` : "";
  }
  if (fig.hasAttribute("data-video")) {
    const src = fig.querySelector("video")?.getAttribute("src") || "";
    const label = caption(fig) || "video";
    return src ? `[▶ ${label}](${src})` : `_[video] ${label}_`;
  }
  if (fig.hasAttribute("data-audio")) {
    const src = fig.querySelector("audio")?.getAttribute("src") || "";
    const label = caption(fig) || "audio";
    return src ? `[♪ ${label}](${src})` : `_[audio] ${label}_`;
  }
  if (fig.hasAttribute("data-link-card")) {
    const href =
      fig.getAttribute("data-href") ||
      fig.querySelector("a")?.getAttribute("href") ||
      "";
    const title = fig.querySelector("[data-card-title]")?.textContent?.trim() || "";
    const site = fig.querySelector("[data-card-site]")?.textContent?.trim() || "";
    const label = [site, title].filter(Boolean).join(" — ") || href || "link";
    return href ? `[${label}](${href})` : label;
  }
  return "";
}

// Render one block element into a Markdown string (which may itself contain
// newlines, e.g. lists or blockquotes). Returns "" for blocks that produce no
// output.
function renderBlock(el: HTMLElement): string {
  const tag = el.tagName;

  if (tag === "FIGURE") return renderFigure(el);

  if (HEADING_LEVEL[tag]) {
    const text = inlineChildren(el).trim();
    return text ? `${"#".repeat(HEADING_LEVEL[tag])} ${text}` : "";
  }

  if (tag === "UL" || tag === "OL") return renderList(el, 0);

  if (tag === "HR") return "---";

  if (tag === "PRE") {
    const code = el.textContent ?? "";
    return "```\n" + code.replace(/\n$/, "") + "\n```";
  }

  if (tag === "BLOCKQUOTE") {
    // Prefix every line of the quote's inner content with "> ".
    const inner = collectBlocks(el).join("\n\n");
    return inner
      .split("\n")
      .map((line) => (line ? `> ${line}` : ">"))
      .join("\n");
  }

  // A DIV whose children are themselves blocks is a wrapper, not a paragraph —
  // recurse so we don't flatten its structure away.
  if (tag === "DIV" && Array.from(el.children).some((c) => isBlock(c as HTMLElement))) {
    return collectBlocks(el).join("\n\n");
  }

  // Paragraphs, divs, and any stray block → a single inline paragraph.
  return inlineChildren(el).trim();
}

// Walk a container's children into an array of block-level Markdown strings.
function collectBlocks(root: HTMLElement): string[] {
  const out: string[] = [];
  Array.from(root.childNodes).forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const md = renderBlock(node as HTMLElement);
      if (md) out.push(md);
    } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      // A bare text node at the top level → treat as a paragraph.
      out.push(node.textContent.replace(/\s+/g, " ").trim());
    }
  });
  return out;
}

// ── Build ────────────────────────────────────────────────────────────────────
// Render the editor's document into a Markdown string. Exposed on its own so it
// can be reused/tested in isolation. Never throws on media.
export function buildDocumentMarkdown(title: string, editor: HTMLElement): string {
  // Clone + strip runtime-only chrome — exactly what the save pipeline persists,
  // so the Markdown matches the saved document.
  const clone = editor.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("[data-drag-handle]").forEach((n) => n.remove());
  clone.querySelectorAll(".is-selected").forEach((n) => n.classList.remove("is-selected"));
  clone
    .querySelectorAll(
      'figure[data-video][data-status], figure[data-audio][data-status], figure[data-link-card][data-status="loading"]',
    )
    .forEach((n) => n.remove());

  const blocks = [`# ${title.trim() || "Untitled"}`, ...collectBlocks(clone)];
  return blocks.join("\n\n") + "\n";
}

// A filesystem-friendly file stem from the document title.
function fileStem(title: string): string {
  const slug = title
    .trim()
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .replace(/\s+/g, "-");
  return slug || "document";
}

// ── Public entry point ───────────────────────────────────────────────────────
// Builds the Markdown and downloads it as a .md file. Unlike the PDF export
// (which opens a new tab), a download is the natural fit for Markdown — it isn't
// a viewable format — and downloads aren't subject to the popup blocker.
export function exportDocumentToMarkdown(opts: {
  title: string;
  editor: HTMLElement;
}): void {
  const { title, editor } = opts;
  const md = buildDocumentMarkdown(title, editor);
  const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileStem(title)}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Give the download a moment to start before releasing the object URL.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
