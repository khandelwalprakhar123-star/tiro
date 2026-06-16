"use server";

// Link "unfurling" — turn a pasted URL into a rich preview card.
//
// WHY a server action: the browser can't fetch arbitrary third-party pages
// (CORS blocks reading the HTML), and we'd leak nothing useful client-side
// anyway. On the server we fetch the page, read its OpenGraph/Twitter meta
// tags (title, description, image, site name), and for known video providers
// (YouTube, Vimeo) we use their oEmbed endpoints to get a clean title +
// thumbnail and an embeddable player URL for inline playback.

export type LinkPreview = {
  url: string;
  kind: "video" | "link";
  title: string;
  description: string;
  image: string; // preview image / thumbnail (may be "")
  siteName: string;
  favicon: string;
  provider: string; // "youtube" | "vimeo" | hostname
  embedUrl: string; // set for kind:"video" — the iframe src
};

const UA =
  "Mozilla/5.0 (compatible; TiroBot/1.0; +https://tiro.works) preview-fetch";
const FETCH_TIMEOUT_MS = 6000;
const MAX_HTML_BYTES = 512 * 1024; // only need the <head>; cap the read

// Block obvious SSRF targets (localhost / private ranges). Best-effort — this
// is a tutorial app, not a hardened crawler, but we shouldn't fetch internal
// hosts on a user's say-so.
function isBlockedHost(host: string) {
  const h = host.toLowerCase();
  if (h === "localhost" || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }
  if (/^(10\.|127\.|0\.|169\.254\.|192\.168\.)/.test(h)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
  if (h === "[::1]" || h.startsWith("[fc") || h.startsWith("[fd")) return true;
  return false;
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

// Pull the content of <meta property="og:x"> / <meta name="x"> tags. Robust to
// attribute order (content-before-property and vice versa).
function metaContent(html: string, key: string): string {
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = re.exec(html);
    if (m?.[1]) return decodeEntities(m[1]);
  }
  return "";
}

function absolutize(maybeRelative: string, base: string) {
  if (!maybeRelative) return "";
  try {
    return new URL(maybeRelative, base).toString();
  } catch {
    return "";
  }
}

function youTubeId(u: URL): string | null {
  if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
  if (/(^|\.)youtube\.com$/.test(u.hostname)) {
    if (u.pathname === "/watch") return u.searchParams.get("v");
    const m = /^\/(embed|shorts|v)\/([^/?]+)/.exec(u.pathname);
    if (m) return m[2];
  }
  return null;
}

function vimeoId(u: URL): string | null {
  if (/(^|\.)vimeo\.com$/.test(u.hostname)) {
    const m = /^\/(\d+)/.exec(u.pathname);
    if (m) return m[1];
  }
  return null;
}

async function fetchWithTimeout(url: string, init?: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, {
      ...init,
      signal: ctrl.signal,
      headers: { "user-agent": UA, accept: "*/*", ...init?.headers },
      redirect: "follow",
    });
  } finally {
    clearTimeout(t);
  }
}

async function oEmbed(endpoint: string) {
  try {
    const res = await fetchWithTimeout(endpoint);
    if (!res.ok) return null;
    return (await res.json()) as {
      title?: string;
      thumbnail_url?: string;
      author_name?: string;
    };
  } catch {
    return null;
  }
}

export async function unfurlUrl(rawUrl: string): Promise<LinkPreview | null> {
  let u: URL;
  try {
    u = new URL(rawUrl);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (isBlockedHost(u.hostname)) return null;

  // ── YouTube ──────────────────────────────────────────────────────────
  const yt = youTubeId(u);
  if (yt) {
    const o = await oEmbed(
      `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(rawUrl)}`,
    );
    return {
      url: rawUrl,
      kind: "video",
      title: o?.title || "YouTube video",
      description: o?.author_name ? `${o.author_name} · YouTube` : "YouTube",
      image: o?.thumbnail_url || `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`,
      siteName: "YouTube",
      favicon: "https://www.youtube.com/s/desktop/favicon.ico",
      provider: "youtube",
      embedUrl: `https://www.youtube-nocookie.com/embed/${yt}`,
    };
  }

  // ── Vimeo ────────────────────────────────────────────────────────────
  const vm = vimeoId(u);
  if (vm) {
    const o = await oEmbed(
      `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(rawUrl)}`,
    );
    return {
      url: rawUrl,
      kind: "video",
      title: o?.title || "Vimeo video",
      description: o?.author_name ? `${o.author_name} · Vimeo` : "Vimeo",
      image: o?.thumbnail_url || "",
      siteName: "Vimeo",
      favicon: "https://vimeo.com/favicon.ico",
      provider: "vimeo",
      embedUrl: `https://player.vimeo.com/video/${vm}`,
    };
  }

  // ── Generic page: read OpenGraph / Twitter meta from the <head>. ───────
  let html = "";
  try {
    const res = await fetchWithTimeout(rawUrl);
    const type = res.headers.get("content-type") || "";
    if (!res.ok || !type.includes("text/html")) {
      // Not an HTML page (e.g. a direct file) — fall back to a bare card.
      return {
        url: rawUrl,
        kind: "link",
        title: u.hostname,
        description: "",
        image: "",
        siteName: u.hostname,
        favicon: absolutize("/favicon.ico", u.origin),
        provider: u.hostname,
        embedUrl: "",
      };
    }
    // Read at most MAX_HTML_BYTES (the head is all we need).
    const reader = res.body?.getReader();
    if (reader) {
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
          total += value.length;
          if (total >= MAX_HTML_BYTES) {
            await reader.cancel();
            break;
          }
        }
      }
      html = new TextDecoder("utf-8").decode(
        chunks.length === 1 ? chunks[0] : Buffer.concat(chunks),
      );
    } else {
      html = (await res.text()).slice(0, MAX_HTML_BYTES);
    }
  } catch {
    return null;
  }

  const titleTag = (() => {
    const m = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
    return m ? decodeEntities(m[1]) : "";
  })();
  const favRel = (() => {
    const m =
      /<link[^>]+rel=["'](?:shortcut )?icon["'][^>]*href=["']([^"']+)["']/i.exec(
        html,
      ) || /<link[^>]+href=["']([^"']+)["'][^>]*rel=["'](?:shortcut )?icon["']/i.exec(html);
    return m?.[1] ?? "";
  })();

  const title =
    metaContent(html, "og:title") ||
    metaContent(html, "twitter:title") ||
    titleTag ||
    u.hostname;
  const description =
    metaContent(html, "og:description") ||
    metaContent(html, "twitter:description") ||
    metaContent(html, "description");
  const image = absolutize(
    metaContent(html, "og:image") ||
      metaContent(html, "og:image:url") ||
      metaContent(html, "twitter:image") ||
      metaContent(html, "twitter:image:src"),
    rawUrl,
  );
  const siteName = metaContent(html, "og:site_name") || u.hostname;
  const favicon = absolutize(favRel || "/favicon.ico", u.origin);

  return {
    url: rawUrl,
    kind: "link",
    title,
    description,
    image,
    siteName,
    favicon,
    provider: u.hostname,
    embedUrl: "",
  };
}
