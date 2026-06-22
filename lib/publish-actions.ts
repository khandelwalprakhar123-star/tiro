"use server";

// Publish-to-Web server actions.
//
// Publishing a document writes a *snapshot* of it (title + sanitized HTML) into
// `public.published_pages`, keyed by a public `slug`. The doc is then viewable,
// with no login, at  <slug>.tiro.works  (the proxy rewrites that subdomain to
// the public /p/[slug] route). Re-publishing overwrites the snapshot but keeps
// the same slug (stable URL). Unpublishing deletes the row.
//
// RLS does the real enforcement (owner-only writes); the requireUser() check
// just fails fast and gives us the uid for owner_id.

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

export type PublishState = {
  slug: string;
  publishedAt: string;
};

// ── Slug generation ────────────────────────────────────────────────────────
// Readable, URL-safe, and a 4-digit suffix so collisions are rare. We still
// check the DB and retry a few times to be certain the slug is free.
const ADJECTIVES = [
  "quiet", "mellow", "bright", "amber", "violet", "crimson", "azure", "olive",
  "golden", "silver", "hazel", "cobalt", "scarlet", "ivory", "russet", "teal",
  "wandering", "drifting", "gentle", "rustic", "velvet", "misty", "humble",
  "ancient", "lucid", "candid", "sunlit", "twilit", "northern", "coastal",
];
const NOUNS = [
  "river", "harbor", "meadow", "canyon", "thicket", "lantern", "ember", "willow",
  "cypress", "comet", "harbour", "summit", "hollow", "orchard", "beacon", "delta",
  "garden", "marsh", "ridge", "cove", "glade", "prairie", "fjord", "atlas",
  "quill", "scribe", "folio", "ledger", "almanac", "canto",
];

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

// Cheap, dependency-free pseudo-randomness (Math.random is fine here — slugs are
// not security tokens, and we verify uniqueness against the DB regardless).
function randomSlug(): string {
  const a = pick(ADJECTIVES, Math.floor(Math.random() * ADJECTIVES.length));
  const n = pick(NOUNS, Math.floor(Math.random() * NOUNS.length));
  const num = Math.floor(1000 + Math.random() * 9000); // 1000–9999
  return `${a}-${n}-${num}`;
}

async function uniqueSlug(
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<string> {
  for (let i = 0; i < 6; i++) {
    const slug = randomSlug();
    const { data } = await supabase
      .from("published_pages")
      .select("slug")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
  }
  // Astronomically unlikely fallback: tack on more entropy.
  return `${randomSlug()}-${Math.floor(Math.random() * 1e6)}`;
}

// ── Sanitization ────────────────────────────────────────────────────────────
// The published HTML is rendered to the public via dangerouslySetInnerHTML, so
// we strip the practical XSS vectors before storing it: <script> blocks, inline
// event-handler attributes (onerror/onload/onclick/…), and javascript: URLs.
// The editor only ever produces a known, tame markup vocabulary (p/h1–5/ul/ol/
// li/figure/img/video/audio/span/a/strong/em/u/br/figcaption/div), so this is a
// belt-and-suspenders pass rather than a full allowlist sanitizer.
//
// NOTE: regex sanitization is not a substitute for a real HTML parser; it is
// sufficient here because the input is owner-authored via our own editor (paste
// is already stripped to plain text upstream). If untrusted HTML is ever ingested
// some other way, swap this for a library sanitizer (e.g. DOMPurify on a JSDOM).
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<\/?script\b[^>]*>/gi, "")
    // Drop on* event-handler attributes:  onerror="…"  onclick='…'  onload=…
    .replace(/\son[a-z-]+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son[a-z-]+\s*=\s*'[^']*'/gi, "")
    .replace(/\son[a-z-]+\s*=\s*[^\s>]+/gi, "")
    // Neutralize javascript: URLs in href/src.
    .replace(/(href|src)\s*=\s*"javascript:[^"]*"/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*'javascript:[^']*'/gi, "$1='#'");
}

// ── Actions ──────────────────────────────────────────────────────────────────

// Publish (or re-publish) a document. Takes a fresh snapshot of the doc's current
// title + content and writes it to the public table. Keeps the existing slug on
// re-publish so the shared URL never changes. Returns the public slug.
export async function publishDocument(docId: string): Promise<PublishState> {
  const { supabase, user } = await requireUser();

  // Read the doc through RLS — only returns it if it's ours and not trashed.
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id, title, content")
    .eq("id", docId)
    .is("deleted_at", null)
    .maybeSingle();
  if (docErr || !doc) throw new Error("Document not found");

  const rawContent = doc.content as { version?: number; html?: unknown } | null;
  const html =
    rawContent && typeof rawContent.html === "string" ? rawContent.html : "";
  const snapshot = { version: 2, html: sanitizeHtml(html) };
  const title = (doc.title || "Untitled").trim() || "Untitled";

  // Already published? Keep the slug, refresh the snapshot (re-publish).
  const { data: existing } = await supabase
    .from("published_pages")
    .select("slug")
    .eq("document_id", docId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("published_pages")
      .update({
        title,
        content: snapshot,
        updated_at: new Date().toISOString(),
      })
      .eq("document_id", docId);
    if (error) throw new Error(error.message);
    return { slug: existing.slug, publishedAt: new Date().toISOString() };
  }

  // First publish: mint a fresh unique slug and insert.
  const slug = await uniqueSlug(supabase);
  const now = new Date().toISOString();
  const { error } = await supabase.from("published_pages").insert({
    slug,
    document_id: docId,
    owner_id: user.id,
    title,
    content: snapshot,
    published_at: now,
    updated_at: now,
  });
  if (error) throw new Error(error.message);
  return { slug, publishedAt: now };
}

// Unpublish — remove the public page (the subdomain 404s afterward).
export async function unpublishDocument(docId: string): Promise<void> {
  const { supabase } = await requireUser();
  const { error } = await supabase
    .from("published_pages")
    .delete()
    .eq("document_id", docId);
  if (error) throw new Error(error.message);
}
