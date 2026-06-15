"use client";

// Client orchestration for pasted-URL link previews. When the pasted text is a
// single URL we drop a "loading" preview card at the caret, ask the server to
// unfurl it (OpenGraph/oEmbed), then fill the card in. For YouTube/Vimeo the
// card's thumbnail swaps to an inline player on click — handled by delegation
// (handlePreviewClick) so it also works on cards restored from saved HTML.

import { useCallback } from "react";
import { unfurlUrl, type LinkPreview } from "@/lib/unfurl-actions";

// A single, whitespace-free http(s) URL — our trigger for a preview. (Bare
// domains without a scheme are treated as plain text, to stay predictable.)
function asUrl(text: string): string | null {
  const t = text.trim();
  if (/\s/.test(t)) return null;
  if (!/^https?:\/\//i.test(t)) return null;
  try {
    new URL(t);
    return t;
  } catch {
    return null;
  }
}

function el(tag: string, attrs: Record<string, string> = {}, text?: string) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

// Build a finished card element from a preview (or a bare fallback).
function buildCard(p: LinkPreview): HTMLElement {
  const figure = el("figure", {
    "data-link-card": "",
    "data-kind": p.kind,
    "data-href": p.url,
    "data-status": "ready",
    contenteditable: "false",
  });
  if (p.kind === "video" && p.embedUrl) {
    figure.setAttribute("data-embed", p.embedUrl);
  }

  if (p.image) {
    const media = el("div", { "data-card-media": "" });
    media.appendChild(el("img", { src: p.image, alt: "", loading: "lazy" }));
    if (p.kind === "video") {
      media.setAttribute("data-yt-play", "");
      const btn = el("span", { "data-play-btn": "", "aria-hidden": "true" });
      media.appendChild(btn);
    }
    figure.appendChild(media);
  }

  const body = el("div", { "data-card-body": "" });
  const site = el("div", { "data-card-site": "" });
  if (p.favicon) {
    site.appendChild(el("img", { src: p.favicon, alt: "", "data-favicon": "" }));
  }
  site.appendChild(el("span", {}, p.siteName || p.provider));
  body.appendChild(site);
  body.appendChild(el("div", { "data-card-title": "" }, p.title || p.url));
  if (p.description) {
    body.appendChild(el("div", { "data-card-desc": "" }, p.description));
  }
  figure.appendChild(body);
  return figure;
}

type Options = {
  insertNodeAtCaret: (node: Node) => void;
  scheduleSave: () => void;
};

export function useLinkPreview({ insertNodeAtCaret, scheduleSave }: Options) {
  // Returns true if it recognised a URL and is handling it (caller should then
  // suppress the default plain-text paste).
  const tryInsertLinkPreview = useCallback(
    (text: string): boolean => {
      const url = asUrl(text);
      if (!url) return false;

      // Loading placeholder (also a usable link immediately, via data-href).
      const placeholder = el("figure", {
        "data-link-card": "",
        "data-kind": "link",
        "data-href": url,
        "data-status": "loading",
        contenteditable: "false",
      });
      const body = el("div", { "data-card-body": "" });
      body.appendChild(el("div", { "data-card-title": "" }, url));
      body.appendChild(el("div", { "data-card-desc": "" }, "Loading preview…"));
      placeholder.appendChild(body);

      const trailing = el("p");
      trailing.appendChild(document.createElement("br"));
      const frag = document.createDocumentFragment();
      frag.appendChild(placeholder);
      frag.appendChild(trailing);
      insertNodeAtCaret(frag);
      scheduleSave();

      void (async () => {
        let preview: LinkPreview | null = null;
        try {
          preview = await unfurlUrl(url);
        } catch {
          preview = null;
        }
        if (!placeholder.isConnected) return;
        const finished = buildCard(
          preview ?? {
            url,
            kind: "link",
            title: url,
            description: "",
            image: "",
            siteName: new URL(url).hostname,
            favicon: "",
            provider: new URL(url).hostname,
            embedUrl: "",
          },
        );
        placeholder.replaceWith(finished);
        scheduleSave();
      })();

      return true;
    },
    [insertNodeAtCaret, scheduleSave],
  );

  // Delegated click handling for preview cards. Returns true if it consumed the
  // click (caller should preventDefault). Play → inline iframe; otherwise open
  // the link in a new tab (reliable inside contenteditable, where bare <a>
  // clicks are flaky).
  const handlePreviewClick = useCallback((e: React.MouseEvent): boolean => {
    const target = e.target as HTMLElement;
    const card = target.closest<HTMLElement>("figure[data-link-card]");
    if (!card) return false;

    const play = target.closest("[data-yt-play]");
    const embed = card.getAttribute("data-embed");
    if (play && embed && !card.querySelector("iframe")) {
      const media = card.querySelector("[data-card-media]");
      if (media) {
        const frame = el("iframe", {
          src: embed.includes("?") ? `${embed}&autoplay=1` : `${embed}?autoplay=1`,
          allow:
            "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture",
          allowfullscreen: "",
          frameborder: "0",
        });
        media.replaceWith(frame);
      }
      return true;
    }

    const href = card.getAttribute("data-href");
    if (href) {
      window.open(href, "_blank", "noopener,noreferrer");
      return true;
    }
    return false;
  }, []);

  return { tryInsertLinkPreview, handlePreviewClick };
}
