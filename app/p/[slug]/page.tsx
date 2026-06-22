import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PublishedDocument } from "./published-document";

// Public, login-free view of a published document. Reached two ways:
//   * directly at  tiro.works/p/<slug>
//   * via the subdomain  <slug>.tiro.works  (proxy.ts rewrites that to this route)
// It reads ONLY `published_pages` (anon-readable). The private `documents` table
// is never touched here, so an anonymous visitor can never reach unpublished docs.

type RouteParams = { params: Promise<{ slug: string }> };

// Fetch the published snapshot for a slug (or null). The RLS policy on
// `published_pages` allows anyone — including the anonymous role — to read it.
async function getPage(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("published_pages")
    .select("title, content, published_at")
    .eq("slug", slug)
    .maybeSingle();
  return data;
}

// Best-effort plain-text excerpt from the saved HTML, for the meta description /
// link previews. (No DOM on the server — a tag strip is enough.)
function excerpt(html: string, max = 160): string {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

export async function generateMetadata({
  params,
}: RouteParams): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) return { title: "Not found · Tiro" };
  const content = page.content as { html?: string } | null;
  const desc = content?.html ? excerpt(content.html) : "";
  return {
    title: `${page.title} · Tiro`,
    description: desc || undefined,
    openGraph: {
      title: page.title,
      description: desc || undefined,
      type: "article",
    },
  };
}

export default async function PublishedPage({ params }: RouteParams) {
  const { slug } = await params;
  const page = await getPage(slug);
  if (!page) notFound();

  const content = page.content as { html?: string } | null;
  const html = typeof content?.html === "string" ? content.html : "";

  return (
    <main className="grain relative min-h-screen bg-paper text-ink">
      <div className="relative z-10 mx-auto max-w-5xl px-8 py-12 sm:py-16">
        <article>
          <h1
            className="font-display text-4xl leading-tight tracking-tight text-ink sm:text-5xl"
            style={{ fontVariationSettings: "'opsz' 144, 'SOFT' 40, 'WONK' 1" }}
          >
            {page.title || "Untitled"}
          </h1>
          <PublishedDocument html={html} />
        </article>

        {/* Quiet attribution footer — also a way back to the product. */}
        <footer className="mt-16 border-t border-line pt-6 text-sm text-ink-soft">
          Published with{" "}
          <Link
            href="https://tiro.works"
            className="text-ink underline-offset-2 hover:underline"
          >
            Tiro
          </Link>
        </footer>
      </div>
    </main>
  );
}
